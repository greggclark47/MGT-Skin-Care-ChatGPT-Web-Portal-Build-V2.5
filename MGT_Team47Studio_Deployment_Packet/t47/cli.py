"""Command-line entry point: `t47 <group> <command>` (or `python -m t47 ...`).

What the tool can and cannot do, by construction:
  * It never sends, posts, publishes or contacts anyone, and it never changes a cloud resource. No such code exists.
  * Diagnostics use GET requests and read files. They change nothing.
  * It writes to its own state directory (review queue, gate state, bake-off results, backups) and to a file you
    name with --out or --dest. Deleting old backups needs --apply.
"""
from __future__ import annotations

import argparse
import getpass
import json
import os
import sys
from dataclasses import asdict
from datetime import date
from pathlib import Path

from t47 import __version__
from t47.config import Settings, load_settings


class CliError(Exception):
    """A problem the operator can fix; printed without a traceback."""


# ---- helpers --------------------------------------------------------------------------------------------------

def _write(path: str | None, text: str) -> None:
    if not text.endswith("\n"):
        text += "\n"
    if path:
        target = Path(path).expanduser()
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text, encoding="utf-8")
        print(f"wrote {target}", file=sys.stderr)
    else:
        sys.stdout.write(text)


def _json(obj) -> str:
    return json.dumps(obj, indent=2, ensure_ascii=False, default=str)


def _table(headers: list[str], rows: list[list]) -> str:
    lines = ["| " + " | ".join(headers) + " |", "|" + "---|" * len(headers)]
    for row in rows:
        lines.append("| " + " | ".join(str(cell if cell is not None else "").replace("|", "\\|").replace("\n", " ") for cell in row) + " |")
    return "\n".join(lines)


def _emit_report(args, report) -> int:
    _write(getattr(args, "out", None), _json(report.to_dict()) if args.json else report.to_markdown())
    return 0 if report.ok else 1


def _operator(value: str | None) -> str:
    return (value or os.environ.get("T47_OPERATOR") or getpass.getuser()).strip()


def _store(settings: Settings):
    from t47.agents.queue import Store

    return Store(settings.state / "queue.sqlite3")


def _backup_key() -> bytes:
    from t47.backup.agentplane import load_key

    return load_key()


# ---- config ---------------------------------------------------------------------------------------------------

def cmd_config_show(args, s: Settings) -> int:
    errors = s.validate()
    data = {**asdict(s), "state_dir_resolved": str(s.state), "cloud_key_present": bool(s.cloud_api_key), "errors": errors}
    if args.json:
        _write(None, _json(data))
    else:
        rows = [[k, json.dumps(v) if isinstance(v, (dict, list)) else v] for k, v in data.items() if k != "errors"]
        _write(None, _table(["Setting", "Value"], rows) + "\n\n" + ("Valid." if not errors else "Problems:\n- " + "\n- ".join(errors)))
    return 0 if not errors else 1


# ---- diagnostics ----------------------------------------------------------------------------------------------

def cmd_diag_site(args, s: Settings) -> int:
    from t47.diagnostics import site

    return _emit_report(args, site.run(args.origin or s.site_origin, args.www or s.site_www, timeout=args.timeout))


def cmd_diag_repo(args, s: Settings) -> int:
    from t47.diagnostics import repo

    path = args.repo or s.repo_path
    if not path:
        raise CliError("name the repository checkout with --repo, or set [paths] repo in the config file")
    return _emit_report(args, repo.run(os.path.expanduser(path), visibility=args.visibility))


def cmd_diag_local(args, s: Settings) -> int:
    from t47.diagnostics import local_ai

    return _emit_report(args, local_ai.run(s, openclaw_home=args.openclaw_home))


# ---- models ---------------------------------------------------------------------------------------------------

def cmd_models_list(args, s: Settings) -> int:
    from t47.models.registry import fit_table

    rows = fit_table(s.vram_gb)
    if args.json:
        _write(args.out, _json(rows))
        return 0
    body = _table(["Model", "Status", "Roles", "Weights GB", f"Fit on {s.vram_gb:.0f} GB", "Confidence", "Source"],
                  [[f"`{r['id']}`", r["status"], ", ".join(r["roles"]), r["size_gb"] if r["size_gb"] is not None else "not read",
                    r["fit"], r["confidence"], r["source"]] for r in rows])
    note = ("\n\nFit is a screening rule on published weight size (fits: 4 GB or more headroom; tight: 1 to 4 GB; exceeds: under 1 GB). "
            "Context memory is extra. The real answer is `ollama ps` after loading the model at the context you will run.")
    _write(args.out, "# Model registry\n\n" + body + note)
    return 0


def cmd_models_bakeoff(args, s: Settings) -> int:
    from t47.models.bakeoff import load_cases, render_markdown, run_bakeoff
    from t47.models.ollama import OllamaClient
    from t47.models.registry import candidates_for
    from t47.util import HttpError

    incumbent = args.incumbent or s.models[args.role]
    models = list(dict.fromkeys([incumbent, *(args.models or candidates_for(args.role, s.vram_gb))]))
    client = OllamaClient(s.ollama_base_url, timeout=max(args.timeout, s.request_timeout_s))
    try:
        installed = {m["name"] for m in client.tags()}
    except (HttpError, ValueError) as exc:
        raise CliError(f"Ollama is not answering at {s.ollama_base_url} ({exc}). Start it and rerun.") from exc

    def present(model: str) -> bool:
        return model in installed or (":" not in model and any(name.split(":")[0] == model for name in installed))

    if not present(incumbent):
        raise CliError(f"the incumbent {incumbent} is not installed; run `ollama pull {incumbent}` first")
    skipped = [m for m in models if not present(m)]
    for model in skipped:
        print(f"skipping {model}: not installed (pull it with `ollama pull {model}` to include it)", file=sys.stderr)
    models = [m for m in models if present(m)]
    cases = load_cases(args.cases)
    if args.limit:
        cases = cases[:args.limit]
    think = {"on": True, "off": False, "agent": None}[args.think]

    def progress(row: dict) -> None:
        state = "pass" if row["passed"] else "FAIL " + ",".join(row["failures"])
        print(f"  {row['model']:<24} {row['case']:<30} {row['ms']:>8.0f} ms  {state}", file=sys.stderr)

    report = run_bakeoff(models, client=client, settings=s, cases=cases, think=think, incumbent=incumbent, progress=progress)
    report["skipped_models"] = skipped
    archive = s.state / "bakeoff"
    archive.mkdir(parents=True, exist_ok=True)
    stamp = report["generated_at"].replace("-", "").replace(":", "")
    (archive / f"bakeoff-{stamp}.json").write_text(_json(report), encoding="utf-8")
    _write(args.out, _json(report) if args.json else render_markdown(report))
    return 0


# ---- agents ---------------------------------------------------------------------------------------------------

def _run_summary(run: dict) -> str:
    lines = [f"Run: {run['id']}", f"Agent: {run['agent_id']}   Status: {run['status']}   Guardrail verdict: {run['verdict']}",
             f"Model: {run.get('provider') or '?'}/{run.get('model') or '?'}   Created by: {run['created_by']}   At: {run['created_at']}"]
    if run.get("reviewed_by"):
        lines.append(f"Reviewed by: {run['reviewed_by']} ({run['review_decision']}) at {run['reviewed_at']}")
    for finding in run["guardrail"]:
        shown = f" [{finding['match']}]" if finding.get("match") else ""
        lines.append(f"  - {finding['severity'].upper()} {finding['rule']}{shown}: {finding['message']}")
    lines += ["", "----- draft -----", run["draft"], "----- end draft -----"]
    return "\n".join(lines)


def cmd_agents_list(args, s: Settings) -> int:
    from t47.agents.roster import load_roster

    roster = load_roster()
    if args.json:
        _write(None, _json([a.public for a in roster.values()]))
        return 0
    rows = [[f"`{a.id}`", a.name, a.origin, s.models.get(a.role, s.models["drafting"]), a.channel, a.profile, "draft only"]
            for a in roster.values()]
    _write(None, _table(["Agent", "Name", "Origin", "Local model", "Channel", "Guardrail profile", "Mode"], rows))
    return 0


def cmd_agents_run(args, s: Settings) -> int:
    from t47.agents.runner import run_agent
    from t47.models.ollama import make_clients

    if bool(args.brief) == bool(args.brief_file):
        raise CliError("give the brief with --brief \"...\" or --brief-file PATH (one of them)")
    brief = args.brief or Path(args.brief_file).expanduser().read_text(encoding="utf-8")
    store = None if args.dry_run else _store(s)
    out = run_agent(args.agent, brief, settings=s, store=store, clients=make_clients(s), source_refs=args.source or [],
                    created_by=args.created_by, data_class=args.data_class, dry_run=args.dry_run)
    if args.dry_run:
        _write(None, _json(out))
        return 0
    run = out["run"]
    if args.submit and run["verdict"] != "blocked":
        run = store.submit(run["id"], _operator(args.actor))
    if args.json:
        _write(None, _json({"run": run, "attempts": out["attempts"]}))
    else:
        _write(None, _run_summary(run))
        nxt = {"blocked": "Blocked by the guardrails: nothing can be submitted. Revise the brief and run again, or edit the draft.",
               "review": f"Next: t47 agents submit {run['id']}   (findings above are shown to the reviewer)",
               "clean": f"Next: t47 agents submit {run['id']}"}[run["verdict"]]
        print(("Submitted for review. Next: t47 agents review " + run["id"] + " --reviewer NAME --decision approve|reject")
              if run["status"] == "pending_review" else nxt, file=sys.stderr)
    return 0 if run["verdict"] != "blocked" else 1


def cmd_agents_queue(args, s: Settings) -> int:
    runs = _store(s).list(status=args.status, agent_id=args.agent, limit=args.limit)
    if args.json:
        _write(None, _json(runs))
        return 0
    rows = [[r["id"], r["agent_id"], r["status"], r["verdict"], r["created_at"], r.get("reviewed_by") or ""] for r in runs]
    _write(None, _table(["Run", "Agent", "Status", "Verdict", "Created", "Reviewer"], rows) if rows else "The queue is empty.")
    return 0


def cmd_agents_show(args, s: Settings) -> int:
    run = _store(s).get(args.run_id)
    _write(None, _json(run) if args.json else _run_summary(run))
    return 0


def cmd_agents_edit(args, s: Settings) -> int:
    from t47.agents.roster import get_agent
    from t47.agents.runner import scan_draft

    store = _store(s)
    run = store.get(args.run_id)
    text = Path(args.file).expanduser().read_text(encoding="utf-8").strip()
    run = store.replace_draft(run["id"], text, scan_draft(get_agent(run["agent_id"]), text, run["brief"]), _operator(args.actor))
    _write(None, _json(run) if args.json else _run_summary(run))
    return 0 if run["verdict"] != "blocked" else 1


def cmd_agents_submit(args, s: Settings) -> int:
    run = _store(s).submit(args.run_id, _operator(args.actor))
    _write(None, _json(run) if args.json else f"{run['id']} is now {run['status']}. A named person other than the creator decides it.")
    return 0


def cmd_agents_review(args, s: Settings) -> int:
    run = _store(s).review(args.run_id, args.reviewer, args.decision, args.note or "")
    _write(None, _json(run) if args.json else f"{run['id']} {run['status']} by {run['reviewed_by']}. Nothing was sent or published.")
    return 0


def cmd_agents_export(args, s: Settings) -> int:
    from t47.agents.export import reviewed_export

    store = _store(s)
    artifact = reviewed_export(store.get(args.run_id))
    if artifact is None:
        raise CliError("only an approved run with a valid draft and valid source references can be exported")
    store.record_export(args.run_id, _operator(args.actor))
    _write(args.out, _json(artifact))
    return 0


def cmd_agents_verify(args, s: Settings) -> int:
    from t47.agents.export import verify_export

    ok = verify_export(json.loads(Path(args.file).expanduser().read_text(encoding="utf-8")))
    _write(None, "digest matches: the reviewed draft is unchanged" if ok else "DIGEST MISMATCH: the file was altered after review")
    return 0 if ok else 1


def cmd_agents_audit(args, s: Settings) -> int:
    log = _store(s).audit_log(args.limit)
    _write(None, _json(log) if args.json else (_table(["At", "Actor", "Action", "Run"], [[e["at"], e["actor"], e["action"], e["target"]] for e in log])
                                                if log else "No audit entries yet."))
    return 0


# ---- OpenClaw and MCP -----------------------------------------------------------------------------------------

def cmd_claw_render(args, s: Settings) -> int:
    from t47.openclaw.render import WORKSPACE_AGENTS_MD, build_fragment, render_fragment

    _write(args.out, _json(build_fragment(s, python_command=args.python)) if args.json else render_fragment(s, python_command=args.python))
    if args.workspace_out:
        _write(args.workspace_out, WORKSPACE_AGENTS_MD)
    return 0


def cmd_claw_audit(args, s: Settings) -> int:
    from t47.openclaw.audit import audit_file

    path = args.file
    if not path:
        home = Path.home() / ".openclaw"
        path = str(next((p for p in (home / "openclaw.json", home / "openclaw.json5") if p.is_file()), home / "openclaw.json"))
    return _emit_report(args, audit_file(path))


def cmd_mcp_serve(args, s: Settings) -> int:
    from t47.mcp import McpServer
    from t47.models.ollama import make_clients

    McpServer(s, _store(s), make_clients(s)).serve()  # stdout carries protocol messages only
    return 0


# ---- go-to-market ---------------------------------------------------------------------------------------------

def cmd_gtm_calendar(args, s: Settings) -> int:
    from t47.gtm.calendar import build_calendar, load_campaign, summary, to_csv

    try:
        start = date.fromisoformat(args.start) if args.start else None
    except ValueError as exc:
        raise CliError("--start must be a date like 2027-01-11") from exc
    rows = build_calendar(start)
    if args.format == "csv":
        _write(args.out, to_csv(rows))
    elif args.format == "json":
        _write(args.out, _json({"summary": summary(rows), "rows": rows}))
    else:
        campaign, info = load_campaign(), summary(rows)
        text = [f"# {campaign['name']}", "", f"{campaign['weeks']} weeks, {info['items']} planned items. Every item is a draft for human review; "
                "nothing is scheduled or published by this tool.", "",
                _table(["Phase", "Weeks", "Items"], [[p["name"], f"{p['weeks'][0]} to {p['weeks'][1]}", info["by_phase"].get(p["name"], 0)]
                                                     for p in campaign["phases"]]), "",
                _table(["Channel", "Status", "Drafting agent", "Approval gate", "Items"],
                       [[c["name"], c["status"], c["agent"], c["gate"], info["by_channel"].get(c["name"], 0)] for c in campaign["channels"]])]
        _write(args.out, "\n".join(text))
    return 0


def cmd_gtm_utm(args, s: Settings) -> int:
    from t47.gtm.utm import build_utm

    _write(None, build_utm(args.url, source=args.source, medium=args.medium, campaign=args.campaign, content=args.content))
    return 0


# ---- economics ------------------------------------------------------------------------------------------------

ECON_ROWS = [("paid_subscribers", "Paid subscribers", "{:,.0f}"), ("gross_mrr", "Gross monthly revenue", "${:,.2f}"),
             ("channel_fees", "Channel fees", "${:,.2f}"), ("net_revenue", "Net revenue", "${:,.2f}"),
             ("variable_costs", "Variable costs", "${:,.2f}"), ("contribution", "Contribution", "${:,.2f}"),
             ("fixed_costs", "Fixed monthly stack", "${:,.2f}"), ("operating_result", "Operating result", "${:,.2f}"),
             ("contribution_per_paid_subscriber", "Contribution per paid subscriber", "${:,.2f}"),
             ("break_even_paid_subscribers", "Break-even paid subscribers", "{:,.0f}"), ("ltv", "Lifetime value", "${:,.2f}"),
             ("cac", "Acquisition cost per subscriber", "${:,.2f}"), ("ltv_to_cac", "LTV to CAC", "{:.1f}x"),
             ("cac_payback_months", "CAC payback, months", "{:.1f}"), ("fee_share_of_gross", "Fees as a share of gross", "{:.1%}")]


def cmd_econ_summary(args, s: Settings) -> int:
    from t47.economics.model import default_scenarios, evaluate
    from t47.util import load_data

    results = [evaluate(sc) for sc in default_scenarios(args.preset)]
    if args.json:
        _write(args.out, _json(results))
        return 0
    preset = load_data("costs.json")["price_presets"][args.preset]
    rows = [[label, *[("n/a" if r[key] is None else fmt.format(r[key])) for r in results]] for key, label, fmt in ECON_ROWS]
    text = (f"# Unit economics, price preset {args.preset}\n\n{preset['label']}: Guided ${preset['guided']:.2f}, Studio ${preset['studio']:.2f} "
            f"a month.\n\n" + _table(["Monthly", *[r["scenario"] for r in results]], rows) +
            "\n\nSubscriber counts, churn and acquisition cost are planning inputs, not forecasts. Prices are not set in production. "
            "Each cost line is labelled sourced, repo, estimate or owner input in t47/data/costs.json and in the workbook.")
    _write(args.out, text)
    return 0


def cmd_econ_workbook(args, s: Settings) -> int:
    from t47.economics.workbook import build_workbook

    info = build_workbook(str(Path(args.out).expanduser()))
    _write(None, _json(info) if args.json else f"wrote {info['path']} ({', '.join(info['sheets'])}). Open it in Excel or Google Sheets to recalculate.")
    return 0


def cmd_econ_local(args, s: Settings) -> int:
    from t47.economics.model import hosted_vs_local

    out = hosted_vs_local(args.tokens_in_m, args.tokens_out_m, price_in=args.price_in, price_out=args.price_out, watts=args.watts,
                          hours=args.hours, kwh_price=args.kwh_price)
    _write(None, _json(out))
    return 0


# ---- backup ---------------------------------------------------------------------------------------------------

def cmd_backup_create(args, s: Settings) -> int:
    from t47.backup.agentplane import create_backup, verify_backup

    key = _backup_key()
    out_dir = Path(args.out).expanduser() if args.out else s.state / "backups"
    receipt = create_backup(s.state, out_dir, key)
    receipt["verified_at"] = verify_backup(receipt["file"], key)["verified_at"]  # decrypt and check before trusting it
    Path(receipt["file"] + ".receipt.json").write_text(_json(receipt), encoding="utf-8")
    _write(None, _json(receipt))
    print("Copy the .t47enc.json file to the private Drive backup folder. The key stays in your password manager.", file=sys.stderr)
    return 0


def cmd_backup_verify(args, s: Settings) -> int:
    from t47.backup.agentplane import verify_backup

    _write(None, _json(verify_backup(Path(args.file).expanduser(), _backup_key())))
    return 0


def cmd_backup_restore(args, s: Settings) -> int:
    from t47.backup.agentplane import restore_backup

    _write(None, _json(restore_backup(Path(args.file).expanduser(), Path(args.dest).expanduser(), _backup_key())))
    return 0


def cmd_backup_prune(args, s: Settings) -> int:
    from t47.backup.agentplane import list_backups
    from t47.backup.retention import plan_retention

    folder = Path(args.dir).expanduser() if args.dir else s.state / "backups"
    found = dict(list_backups(folder)) if folder.is_dir() else {}
    plan = plan_retention(list(found), daily=args.daily, weekly=args.weekly)
    deleted = []
    if args.apply:
        for stamp in plan["prune"]:
            for path in (found[stamp], Path(str(found[stamp]) + ".receipt.json")):
                if path.is_file():
                    path.unlink()
                    deleted.append(str(path))
    result = {"folder": str(folder), "policy": f"{args.daily} daily, {args.weekly} weekly",
              "keep": [found[t].name for t in plan["keep"]], "prune": [found[t].name for t in plan["prune"]],
              "deleted": deleted, "applied": bool(args.apply)}
    _write(None, _json(result))
    if plan["prune"] and not args.apply:
        print("Nothing was deleted. Rerun with --apply to remove the files listed under prune.", file=sys.stderr)
    return 0


def cmd_backup_drill(args, s: Settings) -> int:
    from t47.backup.plan import drill_markdown, evidence_template

    _write(args.out, drill_markdown(args.commit))
    if args.evidence_out:
        _write(args.evidence_out, _json(evidence_template(args.commit)))
    return 0


# ---- release --------------------------------------------------------------------------------------------------

def _gate_file(s: Settings) -> Path:
    return s.state / "gates.json"


def cmd_release_status(args, s: Settings) -> int:
    from t47.release.gates import PLATFORMS, evaluate, load_state, render

    state = load_state(_gate_file(s))
    platforms = PLATFORMS if args.platform == "all" else (args.platform,)
    results = {p: evaluate(p, state) for p in platforms}
    _write(args.out, _json(results) if args.json else render(state, platforms))
    return 1 if args.strict and any(r["decision"] == "HOLD" for r in results.values()) else 0


def cmd_release_gates(args, s: Settings) -> int:
    from t47.release.gates import load_catalog, load_state

    state = load_state(_gate_file(s))
    rows = []
    for gate in load_catalog():
        entry = state[gate["id"]]
        rows.append({"id": gate["id"], "priority": gate["priority"], "platforms": gate["platforms"], "title": gate["title"],
                     "owner": gate["owner"], "evidence_needed": gate["evidence"], "status": entry["status"],
                     "evidence_on_file": entry.get("evidence", ""), "accepted_by": entry.get("accepted_by", ""),
                     "note": entry.get("note") or gate.get("note") or ""})
    if args.json:
        _write(args.out, _json(rows))
    else:
        _write(args.out, _table(["Gate", "Priority", "Platforms", "Status", "Title", "Owner", "Evidence needed", "Evidence on file", "Accepted by"],
                                [[r["id"], r["priority"], ", ".join(r["platforms"]), r["status"], r["title"], r["owner"],
                                  r["evidence_needed"], r["evidence_on_file"], r["accepted_by"]] for r in rows]))
    return 0


def cmd_release_init(args, s: Settings) -> int:
    from t47.release.gates import initial_state, save_state

    target = _gate_file(s)
    if target.exists() and not args.force:
        raise CliError(f"{target} already exists; use --force to start again (this discards recorded gate decisions)")
    save_state(target, initial_state())
    _write(None, f"wrote {target}: every gate is open or reported; none is accepted")
    return 0


def cmd_release_set(args, s: Settings) -> int:
    from t47.release.gates import load_state, save_state, set_gate

    target = _gate_file(s)
    state = set_gate(load_state(target), args.gate, args.status, evidence=args.evidence or "", note=args.note or "", by=args.by or "")
    save_state(target, state)
    _write(None, _json({args.gate: state[args.gate]}))
    return 0


def cmd_release_assets(args, s: Settings) -> int:
    from t47.release.store_assets import check_store_folder

    return _emit_report(args, check_store_folder(os.path.expanduser(args.dir)))


def cmd_release_merge_check(args, s: Settings) -> int:
    from t47.release import mergecheck

    path = args.repo or s.repo_path
    if not path:
        raise CliError("name the repository checkout with --repo, or set [paths] repo in the config file")
    return _emit_report(args, mergecheck.run(os.path.expanduser(path)))


def cmd_version(args, s: Settings) -> int:
    _write(None, f"t47 {__version__}")
    return 0


# ---- parser ---------------------------------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="t47", description="Team 47 Studio deployment and operations packet. "
                                     "Read-only diagnostics, draft-only agents, release gates, economics.")
    parser.add_argument("--config", help="path to a t47.toml file (default: $T47_CONFIG, then ./config/t47.toml, then built-in defaults)")
    parser.add_argument("--version", action="version", version=f"t47 {__version__}")
    groups = parser.add_subparsers(dest="group", metavar="group")
    groups.required = True

    def group(name: str, help_text: str):
        sub = groups.add_parser(name, help=help_text, description=help_text).add_subparsers(dest="command", metavar="command")
        sub.required = True
        return sub

    def leaf(sub, name: str, func, help_text: str, *, out: bool = False, as_json: bool = True):
        p = sub.add_parser(name, help=help_text, description=help_text)
        p.set_defaults(func=func, json=False, out=None)
        if as_json:
            p.add_argument("--json", action="store_true", help="print JSON instead of text")
        if out:
            p.add_argument("--out", help="write the result to this file instead of the terminal")
        return p

    cfg = group("config", "Show the effective settings and check them")
    leaf(cfg, "show", cmd_config_show, "Print the settings in use and any problems")

    diag = group("diagnostics", "Read-only checks of the site, the repository and the local AI plane")
    p = leaf(diag, "site", cmd_diag_site, "GET-only checks of the public site: health, redirects, headers, policy pages, TLS", out=True)
    p.add_argument("--origin", help="site origin (default from config)")
    p.add_argument("--www", help="www host that should redirect to the origin")
    p.add_argument("--timeout", type=float, default=15.0)
    p = leaf(diag, "repo", cmd_diag_repo, "Static inventory of a repository checkout: agents, models, mobile, internal documents", out=True)
    p.add_argument("--repo", help="path to the checkout (default: [paths] repo)")
    p.add_argument("--visibility", choices=("public", "private", "unknown"), default="unknown",
                   help="repository visibility; 'public' turns internal-only documents into a failure")
    p = leaf(diag, "local-ai", cmd_diag_local, "Ollama, GPU and OpenClaw checks. Run on the workstation", out=True)
    p.add_argument("--openclaw-home", help="OpenClaw home directory (default ~/.openclaw)")

    models = group("models", "Model registry and the bake-off harness")
    leaf(models, "list", cmd_models_list, "Incumbent and candidate models with a fit screen for the GPU", out=True)
    p = leaf(models, "bakeoff", cmd_models_bakeoff, "Run the same synthetic cases on each model and print PROPOSE or KEEP. Changes no route", out=True)
    p.add_argument("--models", nargs="+", help="models to compare (default: the incumbent plus registry candidates that fit)")
    p.add_argument("--incumbent", help="model to compare against (default: the configured model for --role)")
    p.add_argument("--role", choices=("drafting", "reasoning"), default="drafting")
    p.add_argument("--cases", help="JSON file with a 'cases' list (default: the packaged cases)")
    p.add_argument("--limit", type=int, help="run only the first N cases (a smoke run; too few cases cannot produce PROPOSE)")
    p.add_argument("--think", choices=("on", "off", "agent"), default="agent", help="reasoning trace: on, off, or each agent's own setting")
    p.add_argument("--timeout", type=float, default=180.0, help="seconds per request")

    agents = group("agents", "Draft-only agents and the human review queue")
    leaf(agents, "list", cmd_agents_list, "The agent roster")
    p = leaf(agents, "run", cmd_agents_run, "Create one draft with a local model and place it in the review queue. Sends nothing")
    p.add_argument("agent", help="agent id, for example customer_care")
    p.add_argument("--brief", help="what to draft, including the facts to use")
    p.add_argument("--brief-file", help="read the brief from a text file")
    p.add_argument("--source", action="append", help="approved source reference: drive:<file id> or a clean https URL (repeatable)")
    p.add_argument("--data-class", choices=("general", "sensitive", "biometric"), default="general",
                   help="sensitive and biometric briefs never leave the workstation, even when the cloud fallback is on")
    p.add_argument("--created-by", help="creator identity (default: the agent identity from the config)")
    p.add_argument("--dry-run", action="store_true", help="show the prompt and the model chain; call no model")
    p.add_argument("--submit", action="store_true", help="submit for review at once when the guardrails do not block")
    p.add_argument("--actor", help="who is submitting (default: $T47_OPERATOR or your login name)")
    p = leaf(agents, "queue", cmd_agents_queue, "List drafts in the review queue")
    p.add_argument("--status", choices=("draft", "pending_review", "approved", "rejected"))
    p.add_argument("--agent")
    p.add_argument("--limit", type=int, default=50)
    p = leaf(agents, "show", cmd_agents_show, "Show one draft with its guardrail findings")
    p.add_argument("run_id")
    p = leaf(agents, "edit", cmd_agents_edit, "Replace a draft's text from a file and rescan it")
    p.add_argument("run_id")
    p.add_argument("--file", required=True)
    p.add_argument("--actor")
    p = leaf(agents, "submit", cmd_agents_submit, "Send a draft to review. Refused while the guardrails block it")
    p.add_argument("run_id")
    p.add_argument("--actor")
    p = leaf(agents, "review", cmd_agents_review, "Approve or reject a draft. The reviewer is a named person and not the creator")
    p.add_argument("run_id")
    p.add_argument("--reviewer", required=True)
    p.add_argument("--decision", required=True, choices=("approve", "reject"))
    p.add_argument("--note")
    p = leaf(agents, "export", cmd_agents_export, "Write the reviewed artifact for an approved draft. Sends nothing", out=True, as_json=False)
    p.add_argument("run_id")
    p.add_argument("--actor")
    p = leaf(agents, "verify", cmd_agents_verify, "Check that an exported artifact is unchanged since review", as_json=False)
    p.add_argument("file")
    p = leaf(agents, "audit", cmd_agents_audit, "Who did what in the review queue")
    p.add_argument("--limit", type=int, default=100)

    claw = group("openclaw", "OpenClaw config fragment and policy audit")
    p = leaf(claw, "render", cmd_claw_render, "Print the config fragment to merge by hand into ~/.openclaw/openclaw.json", out=True)
    p.add_argument("--python", default="python", help="command OpenClaw uses to start the t47 MCP server")
    p.add_argument("--workspace-out", help="also write the workspace AGENTS.md to this path")
    p = leaf(claw, "audit", cmd_claw_audit, "Static policy audit of an OpenClaw config file. Prints no secret values", out=True)
    p.add_argument("file", nargs="?", help="config file (default ~/.openclaw/openclaw.json)")

    mcp = group("mcp", "MCP server for OpenClaw (stdio)")
    leaf(mcp, "serve", cmd_mcp_serve, "Serve list-agents, create-draft and read-queue tools over stdio", as_json=False)

    gtm = group("gtm", "Campaign calendar and campaign links")
    p = leaf(gtm, "calendar", cmd_gtm_calendar, "The 12-week campaign plan as a summary, CSV or JSON", out=True, as_json=False)
    p.add_argument("--start", help="Monday of week 1, as YYYY-MM-DD (leave out for an undated plan)")
    p.add_argument("--format", choices=("summary", "csv", "json"), default="summary")
    p = leaf(gtm, "utm", cmd_gtm_utm, "Build a campaign link. Refuses anything personal or profile-derived", as_json=False)
    p.add_argument("--url", required=True)
    p.add_argument("--source", required=True)
    p.add_argument("--medium", required=True)
    p.add_argument("--campaign", required=True)
    p.add_argument("--content")

    econ = group("economics", "Unit economics and the ROI workbook")
    p = leaf(econ, "summary", cmd_econ_summary, "LEAN, BASE and GROWTH illustrations for a price preset", out=True)
    p.add_argument("--preset", choices=("A", "B"), default="A")
    p = leaf(econ, "workbook", cmd_econ_workbook, "Build the ROI workbook (.xlsx) with live formulas")
    p.add_argument("--out", required=True)
    p = leaf(econ, "local-vs-hosted", cmd_econ_local, "Monthly cost of a token volume on the metered model against workstation electricity", as_json=False)
    p.add_argument("--tokens-in-m", type=float, required=True, help="input tokens per month, in millions")
    p.add_argument("--tokens-out-m", type=float, required=True, help="output tokens per month, in millions")
    p.add_argument("--price-in", type=float, default=0.30)
    p.add_argument("--price-out", type=float, default=1.20)
    p.add_argument("--watts", type=float, default=250)
    p.add_argument("--hours", type=float, default=720)
    p.add_argument("--kwh-price", type=float, default=0.14)

    backup = group("backup", "Encrypted backup of the local agent plane, and the application restore drill")
    p = leaf(backup, "agent-plane", cmd_backup_create, "Encrypt the state directory into one file and verify it", as_json=False)
    p.add_argument("--out", help="folder for the archive (default: <state dir>/backups)")
    p = leaf(backup, "verify", cmd_backup_verify, "Decrypt a backup in memory and check its size and checksum", as_json=False)
    p.add_argument("file")
    p = leaf(backup, "restore", cmd_backup_restore, "Restore a backup into a new, empty folder", as_json=False)
    p.add_argument("file")
    p.add_argument("--dest", required=True)
    p = leaf(backup, "prune", cmd_backup_prune, "List backups outside the retention policy; delete them only with --apply", as_json=False)
    p.add_argument("--dir", help="backup folder (default: <state dir>/backups)")
    p.add_argument("--daily", type=int, default=7)
    p.add_argument("--weekly", type=int, default=4)
    p.add_argument("--apply", action="store_true", help="delete the files listed under prune")
    p = leaf(backup, "drill", cmd_backup_drill, "Print the application backup and restore drill, with the evidence record to fill in", out=True, as_json=False)
    p.add_argument("--commit", default="<40-character sha>", help="release candidate commit")
    p.add_argument("--evidence-out", help="write an empty evidence record (JSON) to this path")

    release = group("release", "Release gates and store assets")
    p = leaf(release, "status", cmd_release_status, "SHIP or HOLD per platform from the recorded gate decisions", out=True)
    p.add_argument("--platform", choices=("web", "android", "ios", "ops", "all"), default="all")
    p.add_argument("--strict", action="store_true", help="exit with status 1 when any requested platform is on HOLD")
    leaf(release, "gates", cmd_release_gates, "The gate catalog with the current status of each gate", out=True)
    p = leaf(release, "init", cmd_release_init, "Create the gate state file with nothing accepted", as_json=False)
    p.add_argument("--force", action="store_true")
    p = leaf(release, "set", cmd_release_set, "Record a gate decision. Accepting needs evidence and the name of the person accepting", as_json=False)
    p.add_argument("gate", help="gate id, for example G07")
    p.add_argument("--status", required=True, choices=("open", "reported", "accepted"))
    p.add_argument("--evidence", help="document id, path or link")
    p.add_argument("--by", help="name of the person accepting the gate")
    p.add_argument("--note")
    p = leaf(release, "merge-check", cmd_release_merge_check, "Read-only preflight: packet, manifest, patches, iOS scripts and CI in a checkout", out=True)
    p.add_argument("--repo", help="path to the monorepo checkout (default: [paths] repo)")
    p = leaf(release, "assets", cmd_release_assets, "Check store images against the Google Play and App Store specifications", out=True)
    p.add_argument("dir", help="folder containing google-play/ and app-store/")

    groups.add_parser("version", help="Print the version").set_defaults(func=cmd_version, json=False, out=None)
    return parser


def main(argv: list[str] | None = None) -> int:
    for stream in (sys.stdin, sys.stdout, sys.stderr):  # Windows consoles default to a legacy code page
        if hasattr(stream, "reconfigure"):
            try:
                stream.reconfigure(encoding="utf-8", errors="replace")
            except (ValueError, OSError):
                pass
    args = build_parser().parse_args(argv)
    try:
        settings = load_settings(args.config)
        if args.func is not cmd_config_show:
            problems = settings.validate()
            if problems:
                raise CliError("the configuration has problems:\n  - " + "\n  - ".join(problems))
        return int(args.func(args, settings) or 0)
    except CliError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    except (FileNotFoundError, KeyError, ValueError, RuntimeError) as exc:
        message = exc.args[0] if isinstance(exc, KeyError) and exc.args else str(exc)
        print(f"error: {message}", file=sys.stderr)
        return 2
    except ImportError as exc:
        if (exc.name or "").startswith("t47."):
            print(f"error: {exc.name} is not in this copy of the packet. Economics and go-to-market modules ship in the private packet only.",
                  file=sys.stderr)
            return 2
        extras = {"openpyxl": "workbook", "cryptography": "backup", "PIL": "assets"}
        extra = extras.get((exc.name or "").split(".")[0])
        hint = f'pip install "t47[{extra}]"' if extra else "install the missing package"
        print(f"error: this command needs an optional package ({exc.name}). Run: {hint}", file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        print("stopped", file=sys.stderr)
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
