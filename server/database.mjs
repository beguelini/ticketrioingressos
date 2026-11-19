export async function database(){return process.env.DATA_BACKEND==='supabase'?(await import('./postgres/db.mjs')).database():(await import('./mongo/db.mjs')).database()}
export async function initialize(db){return db.kind==='supabase'?(await import('./postgres/db.mjs')).initialize(db):(await import('./mongo/db.mjs')).initialize(db)}
