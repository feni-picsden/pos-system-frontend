// UI feature switches for parts of the reference that this install has no data
// for yet. Flip to true when the feature becomes useful; nothing is deleted.

// "Master Database Reference" on brands/categories/tags, suppliers and tax
// rates links a record to Shopfront's central supplier/product catalog. This
// install has no master data (0 master suppliers / products), so the dropdown
// is always empty and only confuses operators. The column, API and saved
// values stay; the field is just not drawn.
export const SHOW_MASTER_DATABASE_REF = false;
