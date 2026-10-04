/**
 * Whether the Google button is shown.
 *
 * Behind a flag so email and password works on a project with no Google OAuth
 * client set up: leave `VITE_ENABLE_GOOGLE_AUTH` out of `.env.local` and the
 * button is not rendered at all, rather than rendered and failing when pressed.
 *
 * Strictly `true`, case-insensitive. Anything else, including a typo like
 * `VITE_ENABLE_GOOGLE_AUTH=yes`, reads as off. A button that appears by accident
 * and then errors on tap is worse than no button, and being strict means the
 * default is always the working path.
 */
export function isGoogleAuthEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === 'true'
}

/** The flag as this build sees it. */
export function googleAuthEnabled(): boolean {
  return isGoogleAuthEnabled(import.meta.env.VITE_ENABLE_GOOGLE_AUTH)
}
