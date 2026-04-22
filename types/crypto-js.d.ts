declare module "crypto-js" {
  type WordArrayLike = unknown;

  interface CryptoJSStatic {
    enc: {
      Utf8: {
        parse(input: string): WordArrayLike;
      };
    };
    SHA256(input: WordArrayLike | string): {
      toString(): string;
    };
  }

  const CryptoJS: CryptoJSStatic;
  export default CryptoJS;
}