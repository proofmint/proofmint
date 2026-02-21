/**
 * Certificate Font Definitions
 *
 * Single source of truth for available fonts in the certificate system.
 * Used both server-side (imageGenerator registration) and client-side (UI dropdown).
 */

export interface CertificateFont {
  /** Font family name used in canvas ctx.font and CSS fontFamily */
  name: string;
  /** Display label shown in the UI dropdown */
  label: string;
  /** TTF filename relative to public/fonts/ (undefined = system font, no file needed) */
  file?: string;
  /** Google Fonts family query parameter for browser preview loading */
  googleFamily?: string;
}

export const CERTIFICATE_FONTS: CertificateFont[] = [
  { name: 'Arial', label: 'Arial' },
  { name: 'Times New Roman', label: 'Times New Roman' },
  { name: 'Inter', label: 'Inter', file: 'Inter-Regular.ttf', googleFamily: 'Inter' },
  { name: 'Roboto', label: 'Roboto', file: 'Roboto-Regular.ttf', googleFamily: 'Roboto' },
  { name: 'Open Sans', label: 'Open Sans', file: 'OpenSans-Regular.ttf', googleFamily: 'Open+Sans' },
  { name: 'Lato', label: 'Lato', file: 'Lato-Regular.ttf', googleFamily: 'Lato' },
  { name: 'Montserrat', label: 'Montserrat', file: 'Montserrat-Regular.ttf', googleFamily: 'Montserrat' },
  { name: 'Playfair Display', label: 'Playfair Display', file: 'PlayfairDisplay-Regular.ttf', googleFamily: 'Playfair+Display' },
  { name: 'Merriweather', label: 'Merriweather', file: 'Merriweather-Regular.ttf', googleFamily: 'Merriweather' },
  { name: 'Poppins', label: 'Poppins', file: 'Poppins-Regular.ttf', googleFamily: 'Poppins' },
  { name: 'Dancing Script', label: 'Dancing Script', file: 'DancingScript-Regular.ttf', googleFamily: 'Dancing+Script' },
  { name: 'Lora', label: 'Lora', file: 'Lora-Regular.ttf', googleFamily: 'Lora' },
];
