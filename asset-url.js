// The ordinary project uses relative files; the portable edition resolves its
// embedded images without changing saved data URLs or external reference links.
export const assetURL=src=>globalThis.__potteryEmbedded?.assetURL(src)||src;
