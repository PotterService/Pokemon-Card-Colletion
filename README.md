# Bow Pokémon Collection Manager — GitHub Pages v4

A no-install Pokémon collection manager that runs entirely in the browser.

## What users need

Only a modern web browser.

Users do not need:

- PHP
- XAMPP
- Composer
- MySQL
- A download
- An account

## Storage

Collections are saved locally in the user's browser with IndexedDB.

Users can:

- Export a JSON backup
- Import a JSON backup
- Export their collection to CSV
- Move their collection between browsers or devices manually

## GitHub Pages setup

1. Create a new public GitHub repository.
2. Upload all files and folders from this project.
3. Open the repository Settings.
4. Select **Pages**.
5. Under **Build and deployment**, choose **Deploy from a branch**.
6. Select the `main` branch and `/ (root)`.
7. Save.

GitHub will provide a public address similar to:

`https://YOUR-USERNAME.github.io/REPOSITORY-NAME/`

## Important

The site loads Pokémon card information and images from the public TCGdex API.

Collection data stays in the visitor's own browser. Clearing browser site data
can erase it, so users should export backups regularly.

## Main features

- Browse Pokémon sets
- Set logos, symbols, dates, and card totals
- Card images
- Owned and missing filters
- Normal, Reverse Holo, and Holo/Special quantities
- Condition tracking
- Purchase price and estimated value
- Favorites
- Trade list
- Wishlist
- Dashboard totals
- Export and import
- CSV export
- Mobile-friendly layout
- Scanner page marked Work in Progress
- Basic Progressive Web App support
