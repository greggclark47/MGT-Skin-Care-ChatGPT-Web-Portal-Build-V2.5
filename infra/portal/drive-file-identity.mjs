// Supported binary-archive share-link profile. This checks identity consistency,
// not existence, access, corporate ownership, folder membership or remote bytes.
export function matchesDriveFileIdentity(fileId, webUrl) {
  if (typeof fileId !== "string" || !/^[A-Za-z0-9_-]+$/.test(fileId) || fileId !== fileId.trim()) return false;
  if (/REPLACE_WITH|YOUR-|placeholder/i.test(fileId)) return false;
  if (typeof webUrl !== "string" || webUrl !== webUrl.trim()) return false;
  // Match raw input before URL parsing can normalize dot segments, escapes,
  // backslashes, credentials, whitespace or host/port variations.
  const match = /^https:\/\/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)(?:\/(?:view|preview|edit))?(?:\?usp=(?:sharing|drive_link|drivesdk))?$/.exec(webUrl);
  return Boolean(match && match[0] === webUrl && match[1] === fileId);
}
