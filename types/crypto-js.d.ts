declare module "crypto-js" {
  type WordArrayLike = unknown;

  interface WordArrayStatic {
    create(input: ArrayLike<number> | ArrayBuffer): WordArrayLike;
  }

  interface CryptoJSStatic {
    lib: {
      WordArray: WordArrayStatic;
    };
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