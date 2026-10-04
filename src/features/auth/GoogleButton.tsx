/**
 * The Google sign-in button.
 *
 * Behind `VITE_ENABLE_GOOGLE_AUTH` so email and password works on a project with
 * no Google OAuth client set up. Off means the button is not rendered, not
 * rendered and broken.
 *
 * The four colours are Google's brand mark. They are the one place in the app
 * that is not from the theme, because a sign-in button that is not recognisably
 * Google's is a support ticket. Everything else uses the tokens in globals.css.
 */
import { Button, type ButtonProps } from '@/components/ui/Button'

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.54 5.54 0 0 1-2.4 3.63v3.02h3.88c2.27-2.09 3.54-5.17 3.54-8.89z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.01c-1.08.72-2.45 1.16-4.05 1.16-3.13 0-5.78-2.11-6.73-4.96H1.28v3.1A11.99 11.99 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28a7.2 7.2 0 0 1 0-4.56V6.62H1.28a11.99 11.99 0 0 0 0 10.76l3.99-3.1z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0A11.99 11.99 0 0 0 1.28 6.62l3.99 3.1C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  )
}

/**
 * Starts the Google flow. `type="button"` on purpose: it sits outside the email
 * form, and a submit button inside a form would send the password form instead.
 */
export function GoogleButton({ className = '', ...rest }: ButtonProps) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="lg"
      iconStart={<GoogleMark />}
      className={className}
      {...rest}
    >
      Continue with Google
    </Button>
  )
}

/** The rule between the email form and the Google button. */
export function AuthDivider() {
  return (
    <div className="flex items-center gap-3" aria-hidden="true">
      <span className="h-px flex-1 bg-border-dark" />
      <span className="text-xs text-text-muted-on-dark">or</span>
      <span className="h-px flex-1 bg-border-dark" />
    </div>
  )
}
