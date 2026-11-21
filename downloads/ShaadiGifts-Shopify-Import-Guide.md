# ShaadiGifts Shopify product import & collection guide

Use this guide with [`ShaadiGifts-Shopify-Products-Import.csv`](ShaadiGifts-Shopify-Products-Import.csv). The CSV contains 28 simple, single-variant sample products from the ShaadiGifts reference prototype.

## Review before importing

- **This is a sample catalog, not verified business data.** Product names, descriptions, types, collection assignments, palettes, and INR amounts were copied from the HTML reference. Confirm every item, description, price, currency, SKU, stock level, materials, personalization, shipping details, and image before offering it for sale.
- **The products are intentionally safe drafts.** Every row has `Status=draft` and `Published on online store=false`. Review and update the product records before changing either setting.
- **Prices are plain numeric amounts copied from the prototype in rupees.** Shopify reads the number in your store's configured currency; confirm the store currency is INR or edit/convert the prices before import. The CSV does not include a `₹` symbol.
- Inventory quantity, SKU, weight, tax settings, product category taxonomy, variants, and images are not supplied because the reference does not provide verified values. Each product will start with its default single variant.
- Product handles are the reference slugs. If any already exist in the store, review the matching products first. Avoid enabling **Overwrite products with matching handles** unless you intend to update those products and have a backup.

## Import the products

1. In Shopify admin, go to **Products → Import**.
2. Upload `ShaadiGifts-Shopify-Products-Import.csv`, then choose **Upload and preview**.
3. Check the preview and import summary, especially the draft/unpublished state, prices, product types, tags, and collection names. Complete the import.
4. Review the imported drafts and fill in verified business details before publishing.

The CSV uses Shopify's current `URL handle`, `Collection`, `Published on online store`, and `Status` headings. Shopify's `Collection` column matches **collection titles**, not handles, and can assign each product to one collection. If a named collection doesn't exist, Shopify can create a manual collection with that name during import. See [Shopify's product CSV guide](https://help.shopify.com/en/manual/products/import-export/using-csv).

## Matching collections

The six collection titles and intended handles below match the storefront categories. The `collection-…` product tag is also the recommended condition for an automated collection.

| Collection title (use this exact title) | Intended handle | Automated collection tag condition | Products | Optional reference cover image in `shadigifts.zip` |
| --- | --- | --- | ---: | --- |
| Return Gifts | `return-gifts` | `collection-return-gifts` | 8 | `shadigifts/images/products/cat-return.jpg` |
| Welcome Hampers | `welcome-hampers` | `collection-welcome-hampers` | 4 | `shadigifts/images/products/cat-hampers.jpg` |
| VIP & Family Gifts | `vip-family-gifts` | `collection-vip-family-gifts` | 4 | `shadigifts/images/products/cat-vip.jpg` |
| Bridal Party Gifts | `bridal-party-gifts` | `collection-bridal-party-gifts` | 4 | `shadigifts/images/products/cat-bridal.jpg` |
| Function Gifts | `function-gifts` | `collection-function-gifts` | 4 | `shadigifts/images/products/function-jars.jpg` |
| Trousseau Packing | `trousseau-packing` | `collection-trousseau-packing` | 4 | `shadigifts/images/products/trousseau.jpg` |

Choose one setup path:

- **Fastest: manual collections from the CSV.** Import without pre-creating collections. Shopify can create the six manual collections from the `Collection` values and add their products. Add descriptions, cover images, and navigation links afterward.
- **Tag-driven: automated collections.** Before importing, create each collection with the exact title in the table. Set it to automatically include products whose **Product tag is equal to** the corresponding `collection-…` tag. Then import the CSV. The tags will keep the groups aligned as you add products later. Avoid having a same-named manual collection as well; Shopify's CSV collection matching is by title. Shopify's [collection setup guide](https://help.shopify.com/en/manual/products/collections/create-collection) explains collection conditions.

Shopify generates collection handles from titles, but the collection CSV field does not set a handle. After creation, check the collection's search-engine listing URL and adjust it to the intended handle in the table if necessary.

## Tags and storefront setup

- `collection-<handle>`: the six category/group tags above; use these for automated collection conditions.
- `type-<slug>`: a normalized tag for the product type, alongside the human-readable Shopify **Type** value (`Bags & Potlis`, `Hampers`, `Gift Boxes`, `Home Décor`, or `Food & Treats`).
- `occasion-<slug>`: reference occasions such as `occasion-haldi`, `occasion-mehendi`, `occasion-sangeet`, and `occasion-wedding`.
- `palette-<slug>`: the reference illustration palette only (for example `palette-crimson` or `palette-gold`); this is **not** a verified product colour or variant.
- Every row also has the general `wedding-gifts` tag. Tag values use lowercase hyphenated text for dependable filtering.

The product images in the reference archive are local files, not public image URLs, so the import CSV intentionally has no image column. Shopify needs publicly accessible image URLs for CSV image imports. To use the reference assets, extract `shadigifts/images/products/` from `shadigifts.zip`, upload the chosen files under **Content → Files**, and use the resulting public HTTPS URLs in a `Product image URL` column (or attach images in each product's admin page). The category cover filenames are mapped above. Treat all reference imagery as sample artwork and verify suitability/rights before publishing.

After the collections exist, open **Online Store → Themes → Customize → Home page → SG · Collections**, select the six collections, and save. The optional **SG · Featured products** section can be assigned a collection after products are verified. For each featured product, **Active** status is not enough: it must also be published to the **Online Store** sales channel and assigned to the exact collection selected in the section settings. The section can only show products storefront-visible in that collection; the imported sample drafts won't appear while they remain drafts or unpublished.
