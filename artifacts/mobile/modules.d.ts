//declare module 'react-native-webrtc-web-shim';

/** Drizzle migrations, inlined as strings by babel-plugin-inline-import. */
declare module "*.sql" {
  const sql: string;
  export default sql;
}
