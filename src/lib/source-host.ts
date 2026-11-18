export const sourceHost = (value: string) => new URL(value).hostname.toLowerCase().replace(/^www\./,'');
