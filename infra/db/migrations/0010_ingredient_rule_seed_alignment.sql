-- Bring the production seed lineage into parity with the canonical reviewed seed in
-- @mgt/domain. Zinc oxide is used by the sunscreen seed product and was added to the
-- canonical matrix after 0004 shipped, but no forward migration had inserted it.
--
-- Preserve any existing reviewed history. A target that already has any zinc-oxide rule
-- must resolve that rule through the normal SME workflow rather than having a migration
-- overwrite or supersede it.

insert into ingredient_rules
  (ingredient_key, version, display_name, sensitivity_ceiling_required, triggers_avoid_flag, rationale, status, sme_approved_by, sme_approved_at)
select
  'zinc_oxide', 1, 'Zinc oxide', 0.1, null,
  'Mineral UV filter, generally well tolerated in leave-on sunscreen formulas.',
  'approved', '00000000-0000-0000-0000-000000000001', now()
where not exists (
  select 1 from ingredient_rules where ingredient_key = 'zinc_oxide'
);
