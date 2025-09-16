export function generateToken(length = 32): string {
	const array = new Uint8Array(length);
	crypto.getRandomValues(array);
	return btoa(String.fromCharCode.apply(null, Array.from(array)))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=/g, '');
}
