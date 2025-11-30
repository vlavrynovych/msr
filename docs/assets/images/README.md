# Favicon Images

This directory contains the favicon images for the documentation site.

## Required Files

To complete the favicon setup, add the following files to this directory:

- `favicon.ico` - Standard ICO format (16x16 and 32x32 sizes combined)
- `favicon-32x32.png` - 32x32 pixel PNG
- `favicon-16x16.png` - 16x16 pixel PNG
- `apple-touch-icon.png` - 180x180 pixel PNG for iOS devices

## Generating Favicons

You can generate these files from your logo using online tools like:

- [Favicon.io](https://favicon.io/) - Generate from text, image, or emoji
- [RealFaviconGenerator](https://realfavicongenerator.net/) - Comprehensive favicon generator

### Using Your Existing Logo

Your current logo is available at:
```
https://avatars.githubusercontent.com/u/150583924?s=200&v=4
```

You can download this image and use it as the source for generating your favicons.

## Manual Creation

If you prefer to create them manually:

1. Download your logo image
2. Resize it to the required dimensions
3. Save in the appropriate formats
4. Place the files in this directory

## Testing

After adding the favicon files, you can test them by:

1. Running Jekyll locally: `bundle exec jekyll serve`
2. Opening your browser to `http://localhost:4000`
3. Checking the browser tab for the favicon
4. Testing on mobile devices for the apple-touch-icon
