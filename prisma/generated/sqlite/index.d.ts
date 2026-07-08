
/**
 * Client
**/

import * as runtime from './runtime/library.js';
import $Types = runtime.Types // general types
import $Public = runtime.Types.Public
import $Utils = runtime.Types.Utils
import $Extensions = runtime.Types.Extensions
import $Result = runtime.Types.Result

export type PrismaPromise<T> = $Public.PrismaPromise<T>


/**
 * Model Customer
 * 
 */
export type Customer = $Result.DefaultSelection<Prisma.$CustomerPayload>
/**
 * Model AuditLog
 * 
 */
export type AuditLog = $Result.DefaultSelection<Prisma.$AuditLogPayload>
/**
 * Model Employee
 * 
 */
export type Employee = $Result.DefaultSelection<Prisma.$EmployeePayload>
/**
 * Model Shift
 * 
 */
export type Shift = $Result.DefaultSelection<Prisma.$ShiftPayload>
/**
 * Model DressModel
 * 
 */
export type DressModel = $Result.DefaultSelection<Prisma.$DressModelPayload>
/**
 * Model DressItem
 * 
 */
export type DressItem = $Result.DefaultSelection<Prisma.$DressItemPayload>
/**
 * Model Order
 * 
 */
export type Order = $Result.DefaultSelection<Prisma.$OrderPayload>
/**
 * Model Payment
 * 
 */
export type Payment = $Result.DefaultSelection<Prisma.$PaymentPayload>
/**
 * Model PaymentObligation
 * 
 */
export type PaymentObligation = $Result.DefaultSelection<Prisma.$PaymentObligationPayload>
/**
 * Model OrderItem
 * 
 */
export type OrderItem = $Result.DefaultSelection<Prisma.$OrderItemPayload>
/**
 * Model PriceList
 * 
 */
export type PriceList = $Result.DefaultSelection<Prisma.$PriceListPayload>
/**
 * Model SystemSetting
 * 
 */
export type SystemSetting = $Result.DefaultSelection<Prisma.$SystemSettingPayload>
/**
 * Model PriceRule
 * 
 */
export type PriceRule = $Result.DefaultSelection<Prisma.$PriceRulePayload>
/**
 * Model PageVisitLog
 * 
 */
export type PageVisitLog = $Result.DefaultSelection<Prisma.$PageVisitLogPayload>
/**
 * Model EmailLog
 * 
 */
export type EmailLog = $Result.DefaultSelection<Prisma.$EmailLogPayload>

/**
 * ##  Prisma Client ʲˢ
 * 
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient()
 * // Fetch zero or more Customers
 * const customers = await prisma.customer.findMany()
 * ```
 *
 * 
 * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
 */
export class PrismaClient<
  ClientOptions extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  U = 'log' extends keyof ClientOptions ? ClientOptions['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition> ? Prisma.GetEvents<ClientOptions['log']> : never : never,
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['other'] }

    /**
   * ##  Prisma Client ʲˢ
   * 
   * Type-safe database client for TypeScript & Node.js
   * @example
   * ```
   * const prisma = new PrismaClient()
   * // Fetch zero or more Customers
   * const customers = await prisma.customer.findMany()
   * ```
   *
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
   */

  constructor(optionsArg ?: Prisma.Subset<ClientOptions, Prisma.PrismaClientOptions>);
  $on<V extends U>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent) => void): void;

  /**
   * Connect with the database
   */
  $connect(): $Utils.JsPromise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): $Utils.JsPromise<void>;

  /**
   * Add a middleware
   * @deprecated since 4.16.0. For new code, prefer client extensions instead.
   * @see https://pris.ly/d/extensions
   */
  $use(cb: Prisma.Middleware): void

/**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * ```
   * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<T>;

  /**
   * Performs a raw query and returns the `SELECT` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>;


  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * ```
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/concepts/components/prisma-client/transactions).
   */
  $transaction<P extends Prisma.PrismaPromise<any>[]>(arg: [...P], options?: { isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>

  $transaction<R>(fn: (prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => $Utils.JsPromise<R>, options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<R>


  $extends: $Extensions.ExtendsHook<"extends", Prisma.TypeMapCb, ExtArgs>

      /**
   * `prisma.customer`: Exposes CRUD operations for the **Customer** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Customers
    * const customers = await prisma.customer.findMany()
    * ```
    */
  get customer(): Prisma.CustomerDelegate<ExtArgs>;

  /**
   * `prisma.auditLog`: Exposes CRUD operations for the **AuditLog** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more AuditLogs
    * const auditLogs = await prisma.auditLog.findMany()
    * ```
    */
  get auditLog(): Prisma.AuditLogDelegate<ExtArgs>;

  /**
   * `prisma.employee`: Exposes CRUD operations for the **Employee** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Employees
    * const employees = await prisma.employee.findMany()
    * ```
    */
  get employee(): Prisma.EmployeeDelegate<ExtArgs>;

  /**
   * `prisma.shift`: Exposes CRUD operations for the **Shift** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Shifts
    * const shifts = await prisma.shift.findMany()
    * ```
    */
  get shift(): Prisma.ShiftDelegate<ExtArgs>;

  /**
   * `prisma.dressModel`: Exposes CRUD operations for the **DressModel** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more DressModels
    * const dressModels = await prisma.dressModel.findMany()
    * ```
    */
  get dressModel(): Prisma.DressModelDelegate<ExtArgs>;

  /**
   * `prisma.dressItem`: Exposes CRUD operations for the **DressItem** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more DressItems
    * const dressItems = await prisma.dressItem.findMany()
    * ```
    */
  get dressItem(): Prisma.DressItemDelegate<ExtArgs>;

  /**
   * `prisma.order`: Exposes CRUD operations for the **Order** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Orders
    * const orders = await prisma.order.findMany()
    * ```
    */
  get order(): Prisma.OrderDelegate<ExtArgs>;

  /**
   * `prisma.payment`: Exposes CRUD operations for the **Payment** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Payments
    * const payments = await prisma.payment.findMany()
    * ```
    */
  get payment(): Prisma.PaymentDelegate<ExtArgs>;

  /**
   * `prisma.paymentObligation`: Exposes CRUD operations for the **PaymentObligation** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more PaymentObligations
    * const paymentObligations = await prisma.paymentObligation.findMany()
    * ```
    */
  get paymentObligation(): Prisma.PaymentObligationDelegate<ExtArgs>;

  /**
   * `prisma.orderItem`: Exposes CRUD operations for the **OrderItem** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more OrderItems
    * const orderItems = await prisma.orderItem.findMany()
    * ```
    */
  get orderItem(): Prisma.OrderItemDelegate<ExtArgs>;

  /**
   * `prisma.priceList`: Exposes CRUD operations for the **PriceList** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more PriceLists
    * const priceLists = await prisma.priceList.findMany()
    * ```
    */
  get priceList(): Prisma.PriceListDelegate<ExtArgs>;

  /**
   * `prisma.systemSetting`: Exposes CRUD operations for the **SystemSetting** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more SystemSettings
    * const systemSettings = await prisma.systemSetting.findMany()
    * ```
    */
  get systemSetting(): Prisma.SystemSettingDelegate<ExtArgs>;

  /**
   * `prisma.priceRule`: Exposes CRUD operations for the **PriceRule** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more PriceRules
    * const priceRules = await prisma.priceRule.findMany()
    * ```
    */
  get priceRule(): Prisma.PriceRuleDelegate<ExtArgs>;

  /**
   * `prisma.pageVisitLog`: Exposes CRUD operations for the **PageVisitLog** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more PageVisitLogs
    * const pageVisitLogs = await prisma.pageVisitLog.findMany()
    * ```
    */
  get pageVisitLog(): Prisma.PageVisitLogDelegate<ExtArgs>;

  /**
   * `prisma.emailLog`: Exposes CRUD operations for the **EmailLog** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more EmailLogs
    * const emailLogs = await prisma.emailLog.findMany()
    * ```
    */
  get emailLog(): Prisma.EmailLogDelegate<ExtArgs>;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF

  export type PrismaPromise<T> = $Public.PrismaPromise<T>

  /**
   * Validator
   */
  export import validator = runtime.Public.validator

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError
  export import PrismaClientValidationError = runtime.PrismaClientValidationError
  export import NotFoundError = runtime.NotFoundError

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag
  export import empty = runtime.empty
  export import join = runtime.join
  export import raw = runtime.raw
  export import Sql = runtime.Sql



  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal

  export type DecimalJsLike = runtime.DecimalJsLike

  /**
   * Metrics 
   */
  export type Metrics = runtime.Metrics
  export type Metric<T> = runtime.Metric<T>
  export type MetricHistogram = runtime.MetricHistogram
  export type MetricHistogramBucket = runtime.MetricHistogramBucket

  /**
  * Extensions
  */
  export import Extension = $Extensions.UserArgs
  export import getExtensionContext = runtime.Extensions.getExtensionContext
  export import Args = $Public.Args
  export import Payload = $Public.Payload
  export import Result = $Public.Result
  export import Exact = $Public.Exact

  /**
   * Prisma Client JS version: 5.22.0
   * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
   */
  export type PrismaVersion = {
    client: string
  }

  export const prismaVersion: PrismaVersion 

  /**
   * Utility Types
   */


  export import JsonObject = runtime.JsonObject
  export import JsonArray = runtime.JsonArray
  export import JsonValue = runtime.JsonValue
  export import InputJsonObject = runtime.InputJsonObject
  export import InputJsonArray = runtime.InputJsonArray
  export import InputJsonValue = runtime.InputJsonValue

  /**
   * Types of the values used to represent different kinds of `null` values when working with JSON fields.
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  namespace NullTypes {
    /**
    * Type of `Prisma.DbNull`.
    * 
    * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
    * 
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class DbNull {
      private DbNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.JsonNull`.
    * 
    * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
    * 
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class JsonNull {
      private JsonNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.AnyNull`.
    * 
    * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
    * 
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class AnyNull {
      private AnyNull: never
      private constructor()
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull

  type SelectAndInclude = {
    select: any
    include: any
  }

  type SelectAndOmit = {
    select: any
    omit: any
  }

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<T extends (...args: any) => $Utils.JsPromise<any>> = PromiseType<ReturnType<T>>

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
      [P in K]: T[P];
  };


  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K
  }[keyof T]

  export type TruthyKeys<T> = keyof {
    [K in keyof T as T[K] extends false | undefined | null ? never : K]: K
  }

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    (T extends SelectAndInclude
      ? 'Please either choose `select` or `include`.'
      : T extends SelectAndOmit
        ? 'Please either choose `select` or `omit`.'
        : {})

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    K

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> =
    T extends object ?
    U extends object ?
      (Without<T, U> & U) | (Without<U, T> & T)
    : U : T


  /**
   * Is T a Record?
   */
  type IsObject<T extends any> = T extends Array<any>
  ? False
  : T extends Date
  ? False
  : T extends Uint8Array
  ? False
  : T extends BigInt
  ? False
  : T extends object
  ? True
  : False


  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O> // With K possibilities
    }[K]

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>

  type _Either<
    O extends object,
    K extends Key,
    strict extends Boolean
  > = {
    1: EitherStrict<O, K>
    0: EitherLoose<O, K>
  }[strict]

  type Either<
    O extends object,
    K extends Key,
    strict extends Boolean = 1
  > = O extends unknown ? _Either<O, K, strict> : never

  export type Union = any

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K]
  } & {}

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (
    U extends unknown ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never

  export type Overwrite<O extends object, O1 extends object> = {
      [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<Overwrite<U, {
      [K in keyof U]-?: At<U, K>;
  }>>;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O ? O[K] : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
  export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
      1: AtStrict<O, K>;
      0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function ? A : {
    [K in keyof A]: A[K];
  } & {};

  export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
  } & {};

  type _Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  // cause typescript not to expand types and preserve names
  type NoExpand<T> = T extends unknown ? T : never;

  // this type assumes the passed object is entirely optional
  type AtLeast<O extends object, K extends string> = NoExpand<
    O extends unknown
    ? | (K extends keyof O ? { [P in K]: O[P] } & O : O)
      | {[P in keyof O as P extends K ? K : never]-?: O[P]} & O
    : never>;

  type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False

  // /**
  // 1
  // */
  export type True = 1

  /**
  0
  */
  export type False = 0

  export type Not<B extends Boolean> = {
    0: 1
    1: 0
  }[B]

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
    ? 1
    : 0

  export type Has<U extends Union, U1 extends Union> = Not<
    Extends<Exclude<U1, U>, U1>
  >

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0
      1: 1
    }
    1: {
      0: 1
      1: 1
    }
  }[B1][B2]

  export type Keys<U extends Union> = U extends unknown ? keyof U : never

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;



  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object ? {
    [P in keyof T]: P extends keyof O
      ? O[P]
      : never
  } : never

  type FieldPaths<
    T,
    U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>
  > = IsObject<T> extends True ? U : T

  type GetHavingFields<T> = {
    [K in keyof T]: Or<
      Or<Extends<'OR', K>, Extends<'AND', K>>,
      Extends<'NOT', K>
    > extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never>
        : never
      : {} extends FieldPaths<T[K]>
      ? never
      : K
  }[keyof T]

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T

  /**
   * Like `Pick`, but additionally can also accept an array of keys
   */
  type PickEnumerable<T, K extends Enumerable<keyof T> | keyof T> = Prisma__Pick<T, MaybeTupleToUnion<K>>

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T


  export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>

  type FieldRefInputType<Model, FieldType> = Model extends never ? never : FieldRef<Model, FieldType>


  export const ModelName: {
    Customer: 'Customer',
    AuditLog: 'AuditLog',
    Employee: 'Employee',
    Shift: 'Shift',
    DressModel: 'DressModel',
    DressItem: 'DressItem',
    Order: 'Order',
    Payment: 'Payment',
    PaymentObligation: 'PaymentObligation',
    OrderItem: 'OrderItem',
    PriceList: 'PriceList',
    SystemSetting: 'SystemSetting',
    PriceRule: 'PriceRule',
    PageVisitLog: 'PageVisitLog',
    EmailLog: 'EmailLog'
  };

  export type ModelName = (typeof ModelName)[keyof typeof ModelName]


  export type Datasources = {
    db?: Datasource
  }

  interface TypeMapCb extends $Utils.Fn<{extArgs: $Extensions.InternalArgs, clientOptions: PrismaClientOptions }, $Utils.Record<string, any>> {
    returns: Prisma.TypeMap<this['params']['extArgs'], this['params']['clientOptions']>
  }

  export type TypeMap<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, ClientOptions = {}> = {
    meta: {
      modelProps: "customer" | "auditLog" | "employee" | "shift" | "dressModel" | "dressItem" | "order" | "payment" | "paymentObligation" | "orderItem" | "priceList" | "systemSetting" | "priceRule" | "pageVisitLog" | "emailLog"
      txIsolationLevel: Prisma.TransactionIsolationLevel
    }
    model: {
      Customer: {
        payload: Prisma.$CustomerPayload<ExtArgs>
        fields: Prisma.CustomerFieldRefs
        operations: {
          findUnique: {
            args: Prisma.CustomerFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomerPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.CustomerFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomerPayload>
          }
          findFirst: {
            args: Prisma.CustomerFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomerPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.CustomerFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomerPayload>
          }
          findMany: {
            args: Prisma.CustomerFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomerPayload>[]
          }
          create: {
            args: Prisma.CustomerCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomerPayload>
          }
          createMany: {
            args: Prisma.CustomerCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.CustomerCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomerPayload>[]
          }
          delete: {
            args: Prisma.CustomerDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomerPayload>
          }
          update: {
            args: Prisma.CustomerUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomerPayload>
          }
          deleteMany: {
            args: Prisma.CustomerDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.CustomerUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.CustomerUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomerPayload>
          }
          aggregate: {
            args: Prisma.CustomerAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateCustomer>
          }
          groupBy: {
            args: Prisma.CustomerGroupByArgs<ExtArgs>
            result: $Utils.Optional<CustomerGroupByOutputType>[]
          }
          count: {
            args: Prisma.CustomerCountArgs<ExtArgs>
            result: $Utils.Optional<CustomerCountAggregateOutputType> | number
          }
        }
      }
      AuditLog: {
        payload: Prisma.$AuditLogPayload<ExtArgs>
        fields: Prisma.AuditLogFieldRefs
        operations: {
          findUnique: {
            args: Prisma.AuditLogFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AuditLogPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.AuditLogFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AuditLogPayload>
          }
          findFirst: {
            args: Prisma.AuditLogFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AuditLogPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.AuditLogFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AuditLogPayload>
          }
          findMany: {
            args: Prisma.AuditLogFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AuditLogPayload>[]
          }
          create: {
            args: Prisma.AuditLogCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AuditLogPayload>
          }
          createMany: {
            args: Prisma.AuditLogCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.AuditLogCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AuditLogPayload>[]
          }
          delete: {
            args: Prisma.AuditLogDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AuditLogPayload>
          }
          update: {
            args: Prisma.AuditLogUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AuditLogPayload>
          }
          deleteMany: {
            args: Prisma.AuditLogDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.AuditLogUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.AuditLogUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AuditLogPayload>
          }
          aggregate: {
            args: Prisma.AuditLogAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateAuditLog>
          }
          groupBy: {
            args: Prisma.AuditLogGroupByArgs<ExtArgs>
            result: $Utils.Optional<AuditLogGroupByOutputType>[]
          }
          count: {
            args: Prisma.AuditLogCountArgs<ExtArgs>
            result: $Utils.Optional<AuditLogCountAggregateOutputType> | number
          }
        }
      }
      Employee: {
        payload: Prisma.$EmployeePayload<ExtArgs>
        fields: Prisma.EmployeeFieldRefs
        operations: {
          findUnique: {
            args: Prisma.EmployeeFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EmployeePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.EmployeeFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EmployeePayload>
          }
          findFirst: {
            args: Prisma.EmployeeFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EmployeePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.EmployeeFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EmployeePayload>
          }
          findMany: {
            args: Prisma.EmployeeFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EmployeePayload>[]
          }
          create: {
            args: Prisma.EmployeeCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EmployeePayload>
          }
          createMany: {
            args: Prisma.EmployeeCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.EmployeeCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EmployeePayload>[]
          }
          delete: {
            args: Prisma.EmployeeDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EmployeePayload>
          }
          update: {
            args: Prisma.EmployeeUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EmployeePayload>
          }
          deleteMany: {
            args: Prisma.EmployeeDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.EmployeeUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.EmployeeUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EmployeePayload>
          }
          aggregate: {
            args: Prisma.EmployeeAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateEmployee>
          }
          groupBy: {
            args: Prisma.EmployeeGroupByArgs<ExtArgs>
            result: $Utils.Optional<EmployeeGroupByOutputType>[]
          }
          count: {
            args: Prisma.EmployeeCountArgs<ExtArgs>
            result: $Utils.Optional<EmployeeCountAggregateOutputType> | number
          }
        }
      }
      Shift: {
        payload: Prisma.$ShiftPayload<ExtArgs>
        fields: Prisma.ShiftFieldRefs
        operations: {
          findUnique: {
            args: Prisma.ShiftFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ShiftPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.ShiftFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ShiftPayload>
          }
          findFirst: {
            args: Prisma.ShiftFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ShiftPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.ShiftFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ShiftPayload>
          }
          findMany: {
            args: Prisma.ShiftFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ShiftPayload>[]
          }
          create: {
            args: Prisma.ShiftCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ShiftPayload>
          }
          createMany: {
            args: Prisma.ShiftCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.ShiftCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ShiftPayload>[]
          }
          delete: {
            args: Prisma.ShiftDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ShiftPayload>
          }
          update: {
            args: Prisma.ShiftUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ShiftPayload>
          }
          deleteMany: {
            args: Prisma.ShiftDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.ShiftUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.ShiftUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ShiftPayload>
          }
          aggregate: {
            args: Prisma.ShiftAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateShift>
          }
          groupBy: {
            args: Prisma.ShiftGroupByArgs<ExtArgs>
            result: $Utils.Optional<ShiftGroupByOutputType>[]
          }
          count: {
            args: Prisma.ShiftCountArgs<ExtArgs>
            result: $Utils.Optional<ShiftCountAggregateOutputType> | number
          }
        }
      }
      DressModel: {
        payload: Prisma.$DressModelPayload<ExtArgs>
        fields: Prisma.DressModelFieldRefs
        operations: {
          findUnique: {
            args: Prisma.DressModelFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DressModelPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.DressModelFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DressModelPayload>
          }
          findFirst: {
            args: Prisma.DressModelFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DressModelPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.DressModelFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DressModelPayload>
          }
          findMany: {
            args: Prisma.DressModelFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DressModelPayload>[]
          }
          create: {
            args: Prisma.DressModelCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DressModelPayload>
          }
          createMany: {
            args: Prisma.DressModelCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.DressModelCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DressModelPayload>[]
          }
          delete: {
            args: Prisma.DressModelDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DressModelPayload>
          }
          update: {
            args: Prisma.DressModelUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DressModelPayload>
          }
          deleteMany: {
            args: Prisma.DressModelDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.DressModelUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.DressModelUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DressModelPayload>
          }
          aggregate: {
            args: Prisma.DressModelAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateDressModel>
          }
          groupBy: {
            args: Prisma.DressModelGroupByArgs<ExtArgs>
            result: $Utils.Optional<DressModelGroupByOutputType>[]
          }
          count: {
            args: Prisma.DressModelCountArgs<ExtArgs>
            result: $Utils.Optional<DressModelCountAggregateOutputType> | number
          }
        }
      }
      DressItem: {
        payload: Prisma.$DressItemPayload<ExtArgs>
        fields: Prisma.DressItemFieldRefs
        operations: {
          findUnique: {
            args: Prisma.DressItemFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DressItemPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.DressItemFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DressItemPayload>
          }
          findFirst: {
            args: Prisma.DressItemFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DressItemPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.DressItemFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DressItemPayload>
          }
          findMany: {
            args: Prisma.DressItemFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DressItemPayload>[]
          }
          create: {
            args: Prisma.DressItemCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DressItemPayload>
          }
          createMany: {
            args: Prisma.DressItemCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.DressItemCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DressItemPayload>[]
          }
          delete: {
            args: Prisma.DressItemDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DressItemPayload>
          }
          update: {
            args: Prisma.DressItemUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DressItemPayload>
          }
          deleteMany: {
            args: Prisma.DressItemDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.DressItemUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.DressItemUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DressItemPayload>
          }
          aggregate: {
            args: Prisma.DressItemAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateDressItem>
          }
          groupBy: {
            args: Prisma.DressItemGroupByArgs<ExtArgs>
            result: $Utils.Optional<DressItemGroupByOutputType>[]
          }
          count: {
            args: Prisma.DressItemCountArgs<ExtArgs>
            result: $Utils.Optional<DressItemCountAggregateOutputType> | number
          }
        }
      }
      Order: {
        payload: Prisma.$OrderPayload<ExtArgs>
        fields: Prisma.OrderFieldRefs
        operations: {
          findUnique: {
            args: Prisma.OrderFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OrderPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.OrderFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OrderPayload>
          }
          findFirst: {
            args: Prisma.OrderFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OrderPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.OrderFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OrderPayload>
          }
          findMany: {
            args: Prisma.OrderFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OrderPayload>[]
          }
          create: {
            args: Prisma.OrderCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OrderPayload>
          }
          createMany: {
            args: Prisma.OrderCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.OrderCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OrderPayload>[]
          }
          delete: {
            args: Prisma.OrderDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OrderPayload>
          }
          update: {
            args: Prisma.OrderUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OrderPayload>
          }
          deleteMany: {
            args: Prisma.OrderDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.OrderUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.OrderUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OrderPayload>
          }
          aggregate: {
            args: Prisma.OrderAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateOrder>
          }
          groupBy: {
            args: Prisma.OrderGroupByArgs<ExtArgs>
            result: $Utils.Optional<OrderGroupByOutputType>[]
          }
          count: {
            args: Prisma.OrderCountArgs<ExtArgs>
            result: $Utils.Optional<OrderCountAggregateOutputType> | number
          }
        }
      }
      Payment: {
        payload: Prisma.$PaymentPayload<ExtArgs>
        fields: Prisma.PaymentFieldRefs
        operations: {
          findUnique: {
            args: Prisma.PaymentFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PaymentPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.PaymentFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PaymentPayload>
          }
          findFirst: {
            args: Prisma.PaymentFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PaymentPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.PaymentFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PaymentPayload>
          }
          findMany: {
            args: Prisma.PaymentFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PaymentPayload>[]
          }
          create: {
            args: Prisma.PaymentCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PaymentPayload>
          }
          createMany: {
            args: Prisma.PaymentCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.PaymentCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PaymentPayload>[]
          }
          delete: {
            args: Prisma.PaymentDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PaymentPayload>
          }
          update: {
            args: Prisma.PaymentUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PaymentPayload>
          }
          deleteMany: {
            args: Prisma.PaymentDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.PaymentUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.PaymentUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PaymentPayload>
          }
          aggregate: {
            args: Prisma.PaymentAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregatePayment>
          }
          groupBy: {
            args: Prisma.PaymentGroupByArgs<ExtArgs>
            result: $Utils.Optional<PaymentGroupByOutputType>[]
          }
          count: {
            args: Prisma.PaymentCountArgs<ExtArgs>
            result: $Utils.Optional<PaymentCountAggregateOutputType> | number
          }
        }
      }
      PaymentObligation: {
        payload: Prisma.$PaymentObligationPayload<ExtArgs>
        fields: Prisma.PaymentObligationFieldRefs
        operations: {
          findUnique: {
            args: Prisma.PaymentObligationFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PaymentObligationPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.PaymentObligationFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PaymentObligationPayload>
          }
          findFirst: {
            args: Prisma.PaymentObligationFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PaymentObligationPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.PaymentObligationFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PaymentObligationPayload>
          }
          findMany: {
            args: Prisma.PaymentObligationFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PaymentObligationPayload>[]
          }
          create: {
            args: Prisma.PaymentObligationCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PaymentObligationPayload>
          }
          createMany: {
            args: Prisma.PaymentObligationCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.PaymentObligationCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PaymentObligationPayload>[]
          }
          delete: {
            args: Prisma.PaymentObligationDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PaymentObligationPayload>
          }
          update: {
            args: Prisma.PaymentObligationUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PaymentObligationPayload>
          }
          deleteMany: {
            args: Prisma.PaymentObligationDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.PaymentObligationUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.PaymentObligationUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PaymentObligationPayload>
          }
          aggregate: {
            args: Prisma.PaymentObligationAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregatePaymentObligation>
          }
          groupBy: {
            args: Prisma.PaymentObligationGroupByArgs<ExtArgs>
            result: $Utils.Optional<PaymentObligationGroupByOutputType>[]
          }
          count: {
            args: Prisma.PaymentObligationCountArgs<ExtArgs>
            result: $Utils.Optional<PaymentObligationCountAggregateOutputType> | number
          }
        }
      }
      OrderItem: {
        payload: Prisma.$OrderItemPayload<ExtArgs>
        fields: Prisma.OrderItemFieldRefs
        operations: {
          findUnique: {
            args: Prisma.OrderItemFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OrderItemPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.OrderItemFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OrderItemPayload>
          }
          findFirst: {
            args: Prisma.OrderItemFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OrderItemPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.OrderItemFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OrderItemPayload>
          }
          findMany: {
            args: Prisma.OrderItemFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OrderItemPayload>[]
          }
          create: {
            args: Prisma.OrderItemCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OrderItemPayload>
          }
          createMany: {
            args: Prisma.OrderItemCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.OrderItemCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OrderItemPayload>[]
          }
          delete: {
            args: Prisma.OrderItemDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OrderItemPayload>
          }
          update: {
            args: Prisma.OrderItemUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OrderItemPayload>
          }
          deleteMany: {
            args: Prisma.OrderItemDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.OrderItemUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.OrderItemUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OrderItemPayload>
          }
          aggregate: {
            args: Prisma.OrderItemAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateOrderItem>
          }
          groupBy: {
            args: Prisma.OrderItemGroupByArgs<ExtArgs>
            result: $Utils.Optional<OrderItemGroupByOutputType>[]
          }
          count: {
            args: Prisma.OrderItemCountArgs<ExtArgs>
            result: $Utils.Optional<OrderItemCountAggregateOutputType> | number
          }
        }
      }
      PriceList: {
        payload: Prisma.$PriceListPayload<ExtArgs>
        fields: Prisma.PriceListFieldRefs
        operations: {
          findUnique: {
            args: Prisma.PriceListFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PriceListPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.PriceListFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PriceListPayload>
          }
          findFirst: {
            args: Prisma.PriceListFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PriceListPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.PriceListFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PriceListPayload>
          }
          findMany: {
            args: Prisma.PriceListFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PriceListPayload>[]
          }
          create: {
            args: Prisma.PriceListCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PriceListPayload>
          }
          createMany: {
            args: Prisma.PriceListCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.PriceListCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PriceListPayload>[]
          }
          delete: {
            args: Prisma.PriceListDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PriceListPayload>
          }
          update: {
            args: Prisma.PriceListUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PriceListPayload>
          }
          deleteMany: {
            args: Prisma.PriceListDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.PriceListUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.PriceListUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PriceListPayload>
          }
          aggregate: {
            args: Prisma.PriceListAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregatePriceList>
          }
          groupBy: {
            args: Prisma.PriceListGroupByArgs<ExtArgs>
            result: $Utils.Optional<PriceListGroupByOutputType>[]
          }
          count: {
            args: Prisma.PriceListCountArgs<ExtArgs>
            result: $Utils.Optional<PriceListCountAggregateOutputType> | number
          }
        }
      }
      SystemSetting: {
        payload: Prisma.$SystemSettingPayload<ExtArgs>
        fields: Prisma.SystemSettingFieldRefs
        operations: {
          findUnique: {
            args: Prisma.SystemSettingFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SystemSettingPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.SystemSettingFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SystemSettingPayload>
          }
          findFirst: {
            args: Prisma.SystemSettingFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SystemSettingPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.SystemSettingFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SystemSettingPayload>
          }
          findMany: {
            args: Prisma.SystemSettingFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SystemSettingPayload>[]
          }
          create: {
            args: Prisma.SystemSettingCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SystemSettingPayload>
          }
          createMany: {
            args: Prisma.SystemSettingCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.SystemSettingCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SystemSettingPayload>[]
          }
          delete: {
            args: Prisma.SystemSettingDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SystemSettingPayload>
          }
          update: {
            args: Prisma.SystemSettingUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SystemSettingPayload>
          }
          deleteMany: {
            args: Prisma.SystemSettingDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.SystemSettingUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.SystemSettingUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SystemSettingPayload>
          }
          aggregate: {
            args: Prisma.SystemSettingAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateSystemSetting>
          }
          groupBy: {
            args: Prisma.SystemSettingGroupByArgs<ExtArgs>
            result: $Utils.Optional<SystemSettingGroupByOutputType>[]
          }
          count: {
            args: Prisma.SystemSettingCountArgs<ExtArgs>
            result: $Utils.Optional<SystemSettingCountAggregateOutputType> | number
          }
        }
      }
      PriceRule: {
        payload: Prisma.$PriceRulePayload<ExtArgs>
        fields: Prisma.PriceRuleFieldRefs
        operations: {
          findUnique: {
            args: Prisma.PriceRuleFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PriceRulePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.PriceRuleFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PriceRulePayload>
          }
          findFirst: {
            args: Prisma.PriceRuleFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PriceRulePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.PriceRuleFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PriceRulePayload>
          }
          findMany: {
            args: Prisma.PriceRuleFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PriceRulePayload>[]
          }
          create: {
            args: Prisma.PriceRuleCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PriceRulePayload>
          }
          createMany: {
            args: Prisma.PriceRuleCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.PriceRuleCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PriceRulePayload>[]
          }
          delete: {
            args: Prisma.PriceRuleDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PriceRulePayload>
          }
          update: {
            args: Prisma.PriceRuleUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PriceRulePayload>
          }
          deleteMany: {
            args: Prisma.PriceRuleDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.PriceRuleUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.PriceRuleUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PriceRulePayload>
          }
          aggregate: {
            args: Prisma.PriceRuleAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregatePriceRule>
          }
          groupBy: {
            args: Prisma.PriceRuleGroupByArgs<ExtArgs>
            result: $Utils.Optional<PriceRuleGroupByOutputType>[]
          }
          count: {
            args: Prisma.PriceRuleCountArgs<ExtArgs>
            result: $Utils.Optional<PriceRuleCountAggregateOutputType> | number
          }
        }
      }
      PageVisitLog: {
        payload: Prisma.$PageVisitLogPayload<ExtArgs>
        fields: Prisma.PageVisitLogFieldRefs
        operations: {
          findUnique: {
            args: Prisma.PageVisitLogFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PageVisitLogPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.PageVisitLogFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PageVisitLogPayload>
          }
          findFirst: {
            args: Prisma.PageVisitLogFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PageVisitLogPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.PageVisitLogFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PageVisitLogPayload>
          }
          findMany: {
            args: Prisma.PageVisitLogFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PageVisitLogPayload>[]
          }
          create: {
            args: Prisma.PageVisitLogCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PageVisitLogPayload>
          }
          createMany: {
            args: Prisma.PageVisitLogCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.PageVisitLogCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PageVisitLogPayload>[]
          }
          delete: {
            args: Prisma.PageVisitLogDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PageVisitLogPayload>
          }
          update: {
            args: Prisma.PageVisitLogUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PageVisitLogPayload>
          }
          deleteMany: {
            args: Prisma.PageVisitLogDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.PageVisitLogUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.PageVisitLogUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PageVisitLogPayload>
          }
          aggregate: {
            args: Prisma.PageVisitLogAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregatePageVisitLog>
          }
          groupBy: {
            args: Prisma.PageVisitLogGroupByArgs<ExtArgs>
            result: $Utils.Optional<PageVisitLogGroupByOutputType>[]
          }
          count: {
            args: Prisma.PageVisitLogCountArgs<ExtArgs>
            result: $Utils.Optional<PageVisitLogCountAggregateOutputType> | number
          }
        }
      }
      EmailLog: {
        payload: Prisma.$EmailLogPayload<ExtArgs>
        fields: Prisma.EmailLogFieldRefs
        operations: {
          findUnique: {
            args: Prisma.EmailLogFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EmailLogPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.EmailLogFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EmailLogPayload>
          }
          findFirst: {
            args: Prisma.EmailLogFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EmailLogPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.EmailLogFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EmailLogPayload>
          }
          findMany: {
            args: Prisma.EmailLogFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EmailLogPayload>[]
          }
          create: {
            args: Prisma.EmailLogCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EmailLogPayload>
          }
          createMany: {
            args: Prisma.EmailLogCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.EmailLogCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EmailLogPayload>[]
          }
          delete: {
            args: Prisma.EmailLogDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EmailLogPayload>
          }
          update: {
            args: Prisma.EmailLogUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EmailLogPayload>
          }
          deleteMany: {
            args: Prisma.EmailLogDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.EmailLogUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.EmailLogUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EmailLogPayload>
          }
          aggregate: {
            args: Prisma.EmailLogAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateEmailLog>
          }
          groupBy: {
            args: Prisma.EmailLogGroupByArgs<ExtArgs>
            result: $Utils.Optional<EmailLogGroupByOutputType>[]
          }
          count: {
            args: Prisma.EmailLogCountArgs<ExtArgs>
            result: $Utils.Optional<EmailLogCountAggregateOutputType> | number
          }
        }
      }
    }
  } & {
    other: {
      payload: any
      operations: {
        $executeRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $executeRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
        $queryRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $queryRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
      }
    }
  }
  export const defineExtension: $Extensions.ExtendsHook<"define", Prisma.TypeMapCb, $Extensions.DefaultArgs>
  export type DefaultPrismaClient = PrismaClient
  export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'
  export interface PrismaClientOptions {
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasources?: Datasources
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasourceUrl?: string
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat
    /**
     * @example
     * ```
     * // Defaults to stdout
     * log: ['query', 'info', 'warn', 'error']
     * 
     * // Emit as events
     * log: [
     *   { emit: 'stdout', level: 'query' },
     *   { emit: 'stdout', level: 'info' },
     *   { emit: 'stdout', level: 'warn' }
     *   { emit: 'stdout', level: 'error' }
     * ]
     * ```
     * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/logging#the-log-option).
     */
    log?: (LogLevel | LogDefinition)[]
    /**
     * The default values for transactionOptions
     * maxWait ?= 2000
     * timeout ?= 5000
     */
    transactionOptions?: {
      maxWait?: number
      timeout?: number
      isolationLevel?: Prisma.TransactionIsolationLevel
    }
  }


  /* Types for Logging */
  export type LogLevel = 'info' | 'query' | 'warn' | 'error'
  export type LogDefinition = {
    level: LogLevel
    emit: 'stdout' | 'event'
  }

  export type GetLogType<T extends LogLevel | LogDefinition> = T extends LogDefinition ? T['emit'] extends 'event' ? T['level'] : never : never
  export type GetEvents<T extends any> = T extends Array<LogLevel | LogDefinition> ?
    GetLogType<T[0]> | GetLogType<T[1]> | GetLogType<T[2]> | GetLogType<T[3]>
    : never

  export type QueryEvent = {
    timestamp: Date
    query: string
    params: string
    duration: number
    target: string
  }

  export type LogEvent = {
    timestamp: Date
    message: string
    target: string
  }
  /* End Types for Logging */


  export type PrismaAction =
    | 'findUnique'
    | 'findUniqueOrThrow'
    | 'findMany'
    | 'findFirst'
    | 'findFirstOrThrow'
    | 'create'
    | 'createMany'
    | 'createManyAndReturn'
    | 'update'
    | 'updateMany'
    | 'upsert'
    | 'delete'
    | 'deleteMany'
    | 'executeRaw'
    | 'queryRaw'
    | 'aggregate'
    | 'count'
    | 'runCommandRaw'
    | 'findRaw'
    | 'groupBy'

  /**
   * These options are being passed into the middleware as "params"
   */
  export type MiddlewareParams = {
    model?: ModelName
    action: PrismaAction
    args: any
    dataPath: string[]
    runInTransaction: boolean
  }

  /**
   * The `T` type makes sure, that the `return proceed` is not forgotten in the middleware implementation
   */
  export type Middleware<T = any> = (
    params: MiddlewareParams,
    next: (params: MiddlewareParams) => $Utils.JsPromise<T>,
  ) => $Utils.JsPromise<T>

  // tested in getLogLevel.test.ts
  export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined;

  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<Prisma.DefaultPrismaClient, runtime.ITXClientDenyList>

  export type Datasource = {
    url?: string
  }

  /**
   * Count Types
   */


  /**
   * Count Type CustomerCountOutputType
   */

  export type CustomerCountOutputType = {
    orders: number
    payments: number
  }

  export type CustomerCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    orders?: boolean | CustomerCountOutputTypeCountOrdersArgs
    payments?: boolean | CustomerCountOutputTypeCountPaymentsArgs
  }

  // Custom InputTypes
  /**
   * CustomerCountOutputType without action
   */
  export type CustomerCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomerCountOutputType
     */
    select?: CustomerCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * CustomerCountOutputType without action
   */
  export type CustomerCountOutputTypeCountOrdersArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: OrderWhereInput
  }

  /**
   * CustomerCountOutputType without action
   */
  export type CustomerCountOutputTypeCountPaymentsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PaymentWhereInput
  }


  /**
   * Count Type EmployeeCountOutputType
   */

  export type EmployeeCountOutputType = {
    pageVisits: number
    shifts: number
  }

  export type EmployeeCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    pageVisits?: boolean | EmployeeCountOutputTypeCountPageVisitsArgs
    shifts?: boolean | EmployeeCountOutputTypeCountShiftsArgs
  }

  // Custom InputTypes
  /**
   * EmployeeCountOutputType without action
   */
  export type EmployeeCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EmployeeCountOutputType
     */
    select?: EmployeeCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * EmployeeCountOutputType without action
   */
  export type EmployeeCountOutputTypeCountPageVisitsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PageVisitLogWhereInput
  }

  /**
   * EmployeeCountOutputType without action
   */
  export type EmployeeCountOutputTypeCountShiftsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ShiftWhereInput
  }


  /**
   * Count Type DressModelCountOutputType
   */

  export type DressModelCountOutputType = {
    items: number
  }

  export type DressModelCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    items?: boolean | DressModelCountOutputTypeCountItemsArgs
  }

  // Custom InputTypes
  /**
   * DressModelCountOutputType without action
   */
  export type DressModelCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DressModelCountOutputType
     */
    select?: DressModelCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * DressModelCountOutputType without action
   */
  export type DressModelCountOutputTypeCountItemsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: DressItemWhereInput
  }


  /**
   * Count Type DressItemCountOutputType
   */

  export type DressItemCountOutputType = {
    orderItems: number
  }

  export type DressItemCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    orderItems?: boolean | DressItemCountOutputTypeCountOrderItemsArgs
  }

  // Custom InputTypes
  /**
   * DressItemCountOutputType without action
   */
  export type DressItemCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DressItemCountOutputType
     */
    select?: DressItemCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * DressItemCountOutputType without action
   */
  export type DressItemCountOutputTypeCountOrderItemsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: OrderItemWhereInput
  }


  /**
   * Count Type OrderCountOutputType
   */

  export type OrderCountOutputType = {
    items: number
    payments: number
    obligations: number
  }

  export type OrderCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    items?: boolean | OrderCountOutputTypeCountItemsArgs
    payments?: boolean | OrderCountOutputTypeCountPaymentsArgs
    obligations?: boolean | OrderCountOutputTypeCountObligationsArgs
  }

  // Custom InputTypes
  /**
   * OrderCountOutputType without action
   */
  export type OrderCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OrderCountOutputType
     */
    select?: OrderCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * OrderCountOutputType without action
   */
  export type OrderCountOutputTypeCountItemsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: OrderItemWhereInput
  }

  /**
   * OrderCountOutputType without action
   */
  export type OrderCountOutputTypeCountPaymentsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PaymentWhereInput
  }

  /**
   * OrderCountOutputType without action
   */
  export type OrderCountOutputTypeCountObligationsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PaymentObligationWhereInput
  }


  /**
   * Models
   */

  /**
   * Model Customer
   */

  export type AggregateCustomer = {
    _count: CustomerCountAggregateOutputType | null
    _avg: CustomerAvgAggregateOutputType | null
    _sum: CustomerSumAggregateOutputType | null
    _min: CustomerMinAggregateOutputType | null
    _max: CustomerMaxAggregateOutputType | null
  }

  export type CustomerAvgAggregateOutputType = {
    id: number | null
    houseNum: number | null
  }

  export type CustomerSumAggregateOutputType = {
    id: number | null
    houseNum: number | null
  }

  export type CustomerMinAggregateOutputType = {
    id: number | null
    firstName: string | null
    lastName: string | null
    phone1: string | null
    phone2: string | null
    city: string | null
    street: string | null
    houseNum: number | null
    email: string | null
    emailSuffix: string | null
    notes: string | null
    registrationDate: string | null
    officeNotes: string | null
    isDeleted: boolean | null
  }

  export type CustomerMaxAggregateOutputType = {
    id: number | null
    firstName: string | null
    lastName: string | null
    phone1: string | null
    phone2: string | null
    city: string | null
    street: string | null
    houseNum: number | null
    email: string | null
    emailSuffix: string | null
    notes: string | null
    registrationDate: string | null
    officeNotes: string | null
    isDeleted: boolean | null
  }

  export type CustomerCountAggregateOutputType = {
    id: number
    firstName: number
    lastName: number
    phone1: number
    phone2: number
    city: number
    street: number
    houseNum: number
    email: number
    emailSuffix: number
    notes: number
    registrationDate: number
    officeNotes: number
    isDeleted: number
    _all: number
  }


  export type CustomerAvgAggregateInputType = {
    id?: true
    houseNum?: true
  }

  export type CustomerSumAggregateInputType = {
    id?: true
    houseNum?: true
  }

  export type CustomerMinAggregateInputType = {
    id?: true
    firstName?: true
    lastName?: true
    phone1?: true
    phone2?: true
    city?: true
    street?: true
    houseNum?: true
    email?: true
    emailSuffix?: true
    notes?: true
    registrationDate?: true
    officeNotes?: true
    isDeleted?: true
  }

  export type CustomerMaxAggregateInputType = {
    id?: true
    firstName?: true
    lastName?: true
    phone1?: true
    phone2?: true
    city?: true
    street?: true
    houseNum?: true
    email?: true
    emailSuffix?: true
    notes?: true
    registrationDate?: true
    officeNotes?: true
    isDeleted?: true
  }

  export type CustomerCountAggregateInputType = {
    id?: true
    firstName?: true
    lastName?: true
    phone1?: true
    phone2?: true
    city?: true
    street?: true
    houseNum?: true
    email?: true
    emailSuffix?: true
    notes?: true
    registrationDate?: true
    officeNotes?: true
    isDeleted?: true
    _all?: true
  }

  export type CustomerAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Customer to aggregate.
     */
    where?: CustomerWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Customers to fetch.
     */
    orderBy?: CustomerOrderByWithRelationInput | CustomerOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: CustomerWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Customers from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Customers.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Customers
    **/
    _count?: true | CustomerCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: CustomerAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: CustomerSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: CustomerMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: CustomerMaxAggregateInputType
  }

  export type GetCustomerAggregateType<T extends CustomerAggregateArgs> = {
        [P in keyof T & keyof AggregateCustomer]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateCustomer[P]>
      : GetScalarType<T[P], AggregateCustomer[P]>
  }




  export type CustomerGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: CustomerWhereInput
    orderBy?: CustomerOrderByWithAggregationInput | CustomerOrderByWithAggregationInput[]
    by: CustomerScalarFieldEnum[] | CustomerScalarFieldEnum
    having?: CustomerScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: CustomerCountAggregateInputType | true
    _avg?: CustomerAvgAggregateInputType
    _sum?: CustomerSumAggregateInputType
    _min?: CustomerMinAggregateInputType
    _max?: CustomerMaxAggregateInputType
  }

  export type CustomerGroupByOutputType = {
    id: number
    firstName: string | null
    lastName: string | null
    phone1: string | null
    phone2: string | null
    city: string | null
    street: string | null
    houseNum: number | null
    email: string | null
    emailSuffix: string | null
    notes: string | null
    registrationDate: string | null
    officeNotes: string | null
    isDeleted: boolean
    _count: CustomerCountAggregateOutputType | null
    _avg: CustomerAvgAggregateOutputType | null
    _sum: CustomerSumAggregateOutputType | null
    _min: CustomerMinAggregateOutputType | null
    _max: CustomerMaxAggregateOutputType | null
  }

  type GetCustomerGroupByPayload<T extends CustomerGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<CustomerGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof CustomerGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], CustomerGroupByOutputType[P]>
            : GetScalarType<T[P], CustomerGroupByOutputType[P]>
        }
      >
    >


  export type CustomerSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    firstName?: boolean
    lastName?: boolean
    phone1?: boolean
    phone2?: boolean
    city?: boolean
    street?: boolean
    houseNum?: boolean
    email?: boolean
    emailSuffix?: boolean
    notes?: boolean
    registrationDate?: boolean
    officeNotes?: boolean
    isDeleted?: boolean
    orders?: boolean | Customer$ordersArgs<ExtArgs>
    payments?: boolean | Customer$paymentsArgs<ExtArgs>
    _count?: boolean | CustomerCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["customer"]>

  export type CustomerSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    firstName?: boolean
    lastName?: boolean
    phone1?: boolean
    phone2?: boolean
    city?: boolean
    street?: boolean
    houseNum?: boolean
    email?: boolean
    emailSuffix?: boolean
    notes?: boolean
    registrationDate?: boolean
    officeNotes?: boolean
    isDeleted?: boolean
  }, ExtArgs["result"]["customer"]>

  export type CustomerSelectScalar = {
    id?: boolean
    firstName?: boolean
    lastName?: boolean
    phone1?: boolean
    phone2?: boolean
    city?: boolean
    street?: boolean
    houseNum?: boolean
    email?: boolean
    emailSuffix?: boolean
    notes?: boolean
    registrationDate?: boolean
    officeNotes?: boolean
    isDeleted?: boolean
  }

  export type CustomerInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    orders?: boolean | Customer$ordersArgs<ExtArgs>
    payments?: boolean | Customer$paymentsArgs<ExtArgs>
    _count?: boolean | CustomerCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type CustomerIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $CustomerPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Customer"
    objects: {
      orders: Prisma.$OrderPayload<ExtArgs>[]
      payments: Prisma.$PaymentPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: number
      firstName: string | null
      lastName: string | null
      phone1: string | null
      phone2: string | null
      city: string | null
      street: string | null
      houseNum: number | null
      email: string | null
      emailSuffix: string | null
      notes: string | null
      registrationDate: string | null
      officeNotes: string | null
      isDeleted: boolean
    }, ExtArgs["result"]["customer"]>
    composites: {}
  }

  type CustomerGetPayload<S extends boolean | null | undefined | CustomerDefaultArgs> = $Result.GetResult<Prisma.$CustomerPayload, S>

  type CustomerCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<CustomerFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: CustomerCountAggregateInputType | true
    }

  export interface CustomerDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Customer'], meta: { name: 'Customer' } }
    /**
     * Find zero or one Customer that matches the filter.
     * @param {CustomerFindUniqueArgs} args - Arguments to find a Customer
     * @example
     * // Get one Customer
     * const customer = await prisma.customer.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends CustomerFindUniqueArgs>(args: SelectSubset<T, CustomerFindUniqueArgs<ExtArgs>>): Prisma__CustomerClient<$Result.GetResult<Prisma.$CustomerPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one Customer that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {CustomerFindUniqueOrThrowArgs} args - Arguments to find a Customer
     * @example
     * // Get one Customer
     * const customer = await prisma.customer.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends CustomerFindUniqueOrThrowArgs>(args: SelectSubset<T, CustomerFindUniqueOrThrowArgs<ExtArgs>>): Prisma__CustomerClient<$Result.GetResult<Prisma.$CustomerPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first Customer that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CustomerFindFirstArgs} args - Arguments to find a Customer
     * @example
     * // Get one Customer
     * const customer = await prisma.customer.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends CustomerFindFirstArgs>(args?: SelectSubset<T, CustomerFindFirstArgs<ExtArgs>>): Prisma__CustomerClient<$Result.GetResult<Prisma.$CustomerPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first Customer that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CustomerFindFirstOrThrowArgs} args - Arguments to find a Customer
     * @example
     * // Get one Customer
     * const customer = await prisma.customer.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends CustomerFindFirstOrThrowArgs>(args?: SelectSubset<T, CustomerFindFirstOrThrowArgs<ExtArgs>>): Prisma__CustomerClient<$Result.GetResult<Prisma.$CustomerPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more Customers that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CustomerFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Customers
     * const customers = await prisma.customer.findMany()
     * 
     * // Get first 10 Customers
     * const customers = await prisma.customer.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const customerWithIdOnly = await prisma.customer.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends CustomerFindManyArgs>(args?: SelectSubset<T, CustomerFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CustomerPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a Customer.
     * @param {CustomerCreateArgs} args - Arguments to create a Customer.
     * @example
     * // Create one Customer
     * const Customer = await prisma.customer.create({
     *   data: {
     *     // ... data to create a Customer
     *   }
     * })
     * 
     */
    create<T extends CustomerCreateArgs>(args: SelectSubset<T, CustomerCreateArgs<ExtArgs>>): Prisma__CustomerClient<$Result.GetResult<Prisma.$CustomerPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many Customers.
     * @param {CustomerCreateManyArgs} args - Arguments to create many Customers.
     * @example
     * // Create many Customers
     * const customer = await prisma.customer.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends CustomerCreateManyArgs>(args?: SelectSubset<T, CustomerCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Customers and returns the data saved in the database.
     * @param {CustomerCreateManyAndReturnArgs} args - Arguments to create many Customers.
     * @example
     * // Create many Customers
     * const customer = await prisma.customer.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Customers and only return the `id`
     * const customerWithIdOnly = await prisma.customer.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends CustomerCreateManyAndReturnArgs>(args?: SelectSubset<T, CustomerCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CustomerPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a Customer.
     * @param {CustomerDeleteArgs} args - Arguments to delete one Customer.
     * @example
     * // Delete one Customer
     * const Customer = await prisma.customer.delete({
     *   where: {
     *     // ... filter to delete one Customer
     *   }
     * })
     * 
     */
    delete<T extends CustomerDeleteArgs>(args: SelectSubset<T, CustomerDeleteArgs<ExtArgs>>): Prisma__CustomerClient<$Result.GetResult<Prisma.$CustomerPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one Customer.
     * @param {CustomerUpdateArgs} args - Arguments to update one Customer.
     * @example
     * // Update one Customer
     * const customer = await prisma.customer.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends CustomerUpdateArgs>(args: SelectSubset<T, CustomerUpdateArgs<ExtArgs>>): Prisma__CustomerClient<$Result.GetResult<Prisma.$CustomerPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more Customers.
     * @param {CustomerDeleteManyArgs} args - Arguments to filter Customers to delete.
     * @example
     * // Delete a few Customers
     * const { count } = await prisma.customer.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends CustomerDeleteManyArgs>(args?: SelectSubset<T, CustomerDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Customers.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CustomerUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Customers
     * const customer = await prisma.customer.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends CustomerUpdateManyArgs>(args: SelectSubset<T, CustomerUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one Customer.
     * @param {CustomerUpsertArgs} args - Arguments to update or create a Customer.
     * @example
     * // Update or create a Customer
     * const customer = await prisma.customer.upsert({
     *   create: {
     *     // ... data to create a Customer
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Customer we want to update
     *   }
     * })
     */
    upsert<T extends CustomerUpsertArgs>(args: SelectSubset<T, CustomerUpsertArgs<ExtArgs>>): Prisma__CustomerClient<$Result.GetResult<Prisma.$CustomerPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of Customers.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CustomerCountArgs} args - Arguments to filter Customers to count.
     * @example
     * // Count the number of Customers
     * const count = await prisma.customer.count({
     *   where: {
     *     // ... the filter for the Customers we want to count
     *   }
     * })
    **/
    count<T extends CustomerCountArgs>(
      args?: Subset<T, CustomerCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], CustomerCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Customer.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CustomerAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends CustomerAggregateArgs>(args: Subset<T, CustomerAggregateArgs>): Prisma.PrismaPromise<GetCustomerAggregateType<T>>

    /**
     * Group by Customer.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CustomerGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends CustomerGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: CustomerGroupByArgs['orderBy'] }
        : { orderBy?: CustomerGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, CustomerGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetCustomerGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Customer model
   */
  readonly fields: CustomerFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Customer.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__CustomerClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    orders<T extends Customer$ordersArgs<ExtArgs> = {}>(args?: Subset<T, Customer$ordersArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$OrderPayload<ExtArgs>, T, "findMany"> | Null>
    payments<T extends Customer$paymentsArgs<ExtArgs> = {}>(args?: Subset<T, Customer$paymentsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PaymentPayload<ExtArgs>, T, "findMany"> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Customer model
   */ 
  interface CustomerFieldRefs {
    readonly id: FieldRef<"Customer", 'Int'>
    readonly firstName: FieldRef<"Customer", 'String'>
    readonly lastName: FieldRef<"Customer", 'String'>
    readonly phone1: FieldRef<"Customer", 'String'>
    readonly phone2: FieldRef<"Customer", 'String'>
    readonly city: FieldRef<"Customer", 'String'>
    readonly street: FieldRef<"Customer", 'String'>
    readonly houseNum: FieldRef<"Customer", 'Int'>
    readonly email: FieldRef<"Customer", 'String'>
    readonly emailSuffix: FieldRef<"Customer", 'String'>
    readonly notes: FieldRef<"Customer", 'String'>
    readonly registrationDate: FieldRef<"Customer", 'String'>
    readonly officeNotes: FieldRef<"Customer", 'String'>
    readonly isDeleted: FieldRef<"Customer", 'Boolean'>
  }
    

  // Custom InputTypes
  /**
   * Customer findUnique
   */
  export type CustomerFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Customer
     */
    select?: CustomerSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerInclude<ExtArgs> | null
    /**
     * Filter, which Customer to fetch.
     */
    where: CustomerWhereUniqueInput
  }

  /**
   * Customer findUniqueOrThrow
   */
  export type CustomerFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Customer
     */
    select?: CustomerSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerInclude<ExtArgs> | null
    /**
     * Filter, which Customer to fetch.
     */
    where: CustomerWhereUniqueInput
  }

  /**
   * Customer findFirst
   */
  export type CustomerFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Customer
     */
    select?: CustomerSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerInclude<ExtArgs> | null
    /**
     * Filter, which Customer to fetch.
     */
    where?: CustomerWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Customers to fetch.
     */
    orderBy?: CustomerOrderByWithRelationInput | CustomerOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Customers.
     */
    cursor?: CustomerWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Customers from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Customers.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Customers.
     */
    distinct?: CustomerScalarFieldEnum | CustomerScalarFieldEnum[]
  }

  /**
   * Customer findFirstOrThrow
   */
  export type CustomerFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Customer
     */
    select?: CustomerSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerInclude<ExtArgs> | null
    /**
     * Filter, which Customer to fetch.
     */
    where?: CustomerWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Customers to fetch.
     */
    orderBy?: CustomerOrderByWithRelationInput | CustomerOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Customers.
     */
    cursor?: CustomerWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Customers from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Customers.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Customers.
     */
    distinct?: CustomerScalarFieldEnum | CustomerScalarFieldEnum[]
  }

  /**
   * Customer findMany
   */
  export type CustomerFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Customer
     */
    select?: CustomerSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerInclude<ExtArgs> | null
    /**
     * Filter, which Customers to fetch.
     */
    where?: CustomerWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Customers to fetch.
     */
    orderBy?: CustomerOrderByWithRelationInput | CustomerOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Customers.
     */
    cursor?: CustomerWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Customers from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Customers.
     */
    skip?: number
    distinct?: CustomerScalarFieldEnum | CustomerScalarFieldEnum[]
  }

  /**
   * Customer create
   */
  export type CustomerCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Customer
     */
    select?: CustomerSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerInclude<ExtArgs> | null
    /**
     * The data needed to create a Customer.
     */
    data?: XOR<CustomerCreateInput, CustomerUncheckedCreateInput>
  }

  /**
   * Customer createMany
   */
  export type CustomerCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Customers.
     */
    data: CustomerCreateManyInput | CustomerCreateManyInput[]
  }

  /**
   * Customer createManyAndReturn
   */
  export type CustomerCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Customer
     */
    select?: CustomerSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many Customers.
     */
    data: CustomerCreateManyInput | CustomerCreateManyInput[]
  }

  /**
   * Customer update
   */
  export type CustomerUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Customer
     */
    select?: CustomerSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerInclude<ExtArgs> | null
    /**
     * The data needed to update a Customer.
     */
    data: XOR<CustomerUpdateInput, CustomerUncheckedUpdateInput>
    /**
     * Choose, which Customer to update.
     */
    where: CustomerWhereUniqueInput
  }

  /**
   * Customer updateMany
   */
  export type CustomerUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Customers.
     */
    data: XOR<CustomerUpdateManyMutationInput, CustomerUncheckedUpdateManyInput>
    /**
     * Filter which Customers to update
     */
    where?: CustomerWhereInput
  }

  /**
   * Customer upsert
   */
  export type CustomerUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Customer
     */
    select?: CustomerSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerInclude<ExtArgs> | null
    /**
     * The filter to search for the Customer to update in case it exists.
     */
    where: CustomerWhereUniqueInput
    /**
     * In case the Customer found by the `where` argument doesn't exist, create a new Customer with this data.
     */
    create: XOR<CustomerCreateInput, CustomerUncheckedCreateInput>
    /**
     * In case the Customer was found with the provided `where` argument, update it with this data.
     */
    update: XOR<CustomerUpdateInput, CustomerUncheckedUpdateInput>
  }

  /**
   * Customer delete
   */
  export type CustomerDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Customer
     */
    select?: CustomerSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerInclude<ExtArgs> | null
    /**
     * Filter which Customer to delete.
     */
    where: CustomerWhereUniqueInput
  }

  /**
   * Customer deleteMany
   */
  export type CustomerDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Customers to delete
     */
    where?: CustomerWhereInput
  }

  /**
   * Customer.orders
   */
  export type Customer$ordersArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Order
     */
    select?: OrderSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrderInclude<ExtArgs> | null
    where?: OrderWhereInput
    orderBy?: OrderOrderByWithRelationInput | OrderOrderByWithRelationInput[]
    cursor?: OrderWhereUniqueInput
    take?: number
    skip?: number
    distinct?: OrderScalarFieldEnum | OrderScalarFieldEnum[]
  }

  /**
   * Customer.payments
   */
  export type Customer$paymentsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Payment
     */
    select?: PaymentSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PaymentInclude<ExtArgs> | null
    where?: PaymentWhereInput
    orderBy?: PaymentOrderByWithRelationInput | PaymentOrderByWithRelationInput[]
    cursor?: PaymentWhereUniqueInput
    take?: number
    skip?: number
    distinct?: PaymentScalarFieldEnum | PaymentScalarFieldEnum[]
  }

  /**
   * Customer without action
   */
  export type CustomerDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Customer
     */
    select?: CustomerSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerInclude<ExtArgs> | null
  }


  /**
   * Model AuditLog
   */

  export type AggregateAuditLog = {
    _count: AuditLogCountAggregateOutputType | null
    _avg: AuditLogAvgAggregateOutputType | null
    _sum: AuditLogSumAggregateOutputType | null
    _min: AuditLogMinAggregateOutputType | null
    _max: AuditLogMaxAggregateOutputType | null
  }

  export type AuditLogAvgAggregateOutputType = {
    id: number | null
    entityId: number | null
    employeeId: number | null
  }

  export type AuditLogSumAggregateOutputType = {
    id: number | null
    entityId: number | null
    employeeId: number | null
  }

  export type AuditLogMinAggregateOutputType = {
    id: number | null
    entityType: string | null
    entityId: number | null
    action: string | null
    changesJson: string | null
    createdAt: Date | null
    employeeId: number | null
  }

  export type AuditLogMaxAggregateOutputType = {
    id: number | null
    entityType: string | null
    entityId: number | null
    action: string | null
    changesJson: string | null
    createdAt: Date | null
    employeeId: number | null
  }

  export type AuditLogCountAggregateOutputType = {
    id: number
    entityType: number
    entityId: number
    action: number
    changesJson: number
    createdAt: number
    employeeId: number
    _all: number
  }


  export type AuditLogAvgAggregateInputType = {
    id?: true
    entityId?: true
    employeeId?: true
  }

  export type AuditLogSumAggregateInputType = {
    id?: true
    entityId?: true
    employeeId?: true
  }

  export type AuditLogMinAggregateInputType = {
    id?: true
    entityType?: true
    entityId?: true
    action?: true
    changesJson?: true
    createdAt?: true
    employeeId?: true
  }

  export type AuditLogMaxAggregateInputType = {
    id?: true
    entityType?: true
    entityId?: true
    action?: true
    changesJson?: true
    createdAt?: true
    employeeId?: true
  }

  export type AuditLogCountAggregateInputType = {
    id?: true
    entityType?: true
    entityId?: true
    action?: true
    changesJson?: true
    createdAt?: true
    employeeId?: true
    _all?: true
  }

  export type AuditLogAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which AuditLog to aggregate.
     */
    where?: AuditLogWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AuditLogs to fetch.
     */
    orderBy?: AuditLogOrderByWithRelationInput | AuditLogOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: AuditLogWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AuditLogs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AuditLogs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned AuditLogs
    **/
    _count?: true | AuditLogCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: AuditLogAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: AuditLogSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: AuditLogMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: AuditLogMaxAggregateInputType
  }

  export type GetAuditLogAggregateType<T extends AuditLogAggregateArgs> = {
        [P in keyof T & keyof AggregateAuditLog]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateAuditLog[P]>
      : GetScalarType<T[P], AggregateAuditLog[P]>
  }




  export type AuditLogGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: AuditLogWhereInput
    orderBy?: AuditLogOrderByWithAggregationInput | AuditLogOrderByWithAggregationInput[]
    by: AuditLogScalarFieldEnum[] | AuditLogScalarFieldEnum
    having?: AuditLogScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: AuditLogCountAggregateInputType | true
    _avg?: AuditLogAvgAggregateInputType
    _sum?: AuditLogSumAggregateInputType
    _min?: AuditLogMinAggregateInputType
    _max?: AuditLogMaxAggregateInputType
  }

  export type AuditLogGroupByOutputType = {
    id: number
    entityType: string
    entityId: number
    action: string
    changesJson: string
    createdAt: Date
    employeeId: number | null
    _count: AuditLogCountAggregateOutputType | null
    _avg: AuditLogAvgAggregateOutputType | null
    _sum: AuditLogSumAggregateOutputType | null
    _min: AuditLogMinAggregateOutputType | null
    _max: AuditLogMaxAggregateOutputType | null
  }

  type GetAuditLogGroupByPayload<T extends AuditLogGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<AuditLogGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof AuditLogGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], AuditLogGroupByOutputType[P]>
            : GetScalarType<T[P], AuditLogGroupByOutputType[P]>
        }
      >
    >


  export type AuditLogSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    entityType?: boolean
    entityId?: boolean
    action?: boolean
    changesJson?: boolean
    createdAt?: boolean
    employeeId?: boolean
  }, ExtArgs["result"]["auditLog"]>

  export type AuditLogSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    entityType?: boolean
    entityId?: boolean
    action?: boolean
    changesJson?: boolean
    createdAt?: boolean
    employeeId?: boolean
  }, ExtArgs["result"]["auditLog"]>

  export type AuditLogSelectScalar = {
    id?: boolean
    entityType?: boolean
    entityId?: boolean
    action?: boolean
    changesJson?: boolean
    createdAt?: boolean
    employeeId?: boolean
  }


  export type $AuditLogPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "AuditLog"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: number
      entityType: string
      entityId: number
      action: string
      changesJson: string
      createdAt: Date
      employeeId: number | null
    }, ExtArgs["result"]["auditLog"]>
    composites: {}
  }

  type AuditLogGetPayload<S extends boolean | null | undefined | AuditLogDefaultArgs> = $Result.GetResult<Prisma.$AuditLogPayload, S>

  type AuditLogCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<AuditLogFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: AuditLogCountAggregateInputType | true
    }

  export interface AuditLogDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['AuditLog'], meta: { name: 'AuditLog' } }
    /**
     * Find zero or one AuditLog that matches the filter.
     * @param {AuditLogFindUniqueArgs} args - Arguments to find a AuditLog
     * @example
     * // Get one AuditLog
     * const auditLog = await prisma.auditLog.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends AuditLogFindUniqueArgs>(args: SelectSubset<T, AuditLogFindUniqueArgs<ExtArgs>>): Prisma__AuditLogClient<$Result.GetResult<Prisma.$AuditLogPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one AuditLog that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {AuditLogFindUniqueOrThrowArgs} args - Arguments to find a AuditLog
     * @example
     * // Get one AuditLog
     * const auditLog = await prisma.auditLog.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends AuditLogFindUniqueOrThrowArgs>(args: SelectSubset<T, AuditLogFindUniqueOrThrowArgs<ExtArgs>>): Prisma__AuditLogClient<$Result.GetResult<Prisma.$AuditLogPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first AuditLog that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AuditLogFindFirstArgs} args - Arguments to find a AuditLog
     * @example
     * // Get one AuditLog
     * const auditLog = await prisma.auditLog.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends AuditLogFindFirstArgs>(args?: SelectSubset<T, AuditLogFindFirstArgs<ExtArgs>>): Prisma__AuditLogClient<$Result.GetResult<Prisma.$AuditLogPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first AuditLog that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AuditLogFindFirstOrThrowArgs} args - Arguments to find a AuditLog
     * @example
     * // Get one AuditLog
     * const auditLog = await prisma.auditLog.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends AuditLogFindFirstOrThrowArgs>(args?: SelectSubset<T, AuditLogFindFirstOrThrowArgs<ExtArgs>>): Prisma__AuditLogClient<$Result.GetResult<Prisma.$AuditLogPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more AuditLogs that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AuditLogFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all AuditLogs
     * const auditLogs = await prisma.auditLog.findMany()
     * 
     * // Get first 10 AuditLogs
     * const auditLogs = await prisma.auditLog.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const auditLogWithIdOnly = await prisma.auditLog.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends AuditLogFindManyArgs>(args?: SelectSubset<T, AuditLogFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AuditLogPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a AuditLog.
     * @param {AuditLogCreateArgs} args - Arguments to create a AuditLog.
     * @example
     * // Create one AuditLog
     * const AuditLog = await prisma.auditLog.create({
     *   data: {
     *     // ... data to create a AuditLog
     *   }
     * })
     * 
     */
    create<T extends AuditLogCreateArgs>(args: SelectSubset<T, AuditLogCreateArgs<ExtArgs>>): Prisma__AuditLogClient<$Result.GetResult<Prisma.$AuditLogPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many AuditLogs.
     * @param {AuditLogCreateManyArgs} args - Arguments to create many AuditLogs.
     * @example
     * // Create many AuditLogs
     * const auditLog = await prisma.auditLog.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends AuditLogCreateManyArgs>(args?: SelectSubset<T, AuditLogCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many AuditLogs and returns the data saved in the database.
     * @param {AuditLogCreateManyAndReturnArgs} args - Arguments to create many AuditLogs.
     * @example
     * // Create many AuditLogs
     * const auditLog = await prisma.auditLog.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many AuditLogs and only return the `id`
     * const auditLogWithIdOnly = await prisma.auditLog.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends AuditLogCreateManyAndReturnArgs>(args?: SelectSubset<T, AuditLogCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AuditLogPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a AuditLog.
     * @param {AuditLogDeleteArgs} args - Arguments to delete one AuditLog.
     * @example
     * // Delete one AuditLog
     * const AuditLog = await prisma.auditLog.delete({
     *   where: {
     *     // ... filter to delete one AuditLog
     *   }
     * })
     * 
     */
    delete<T extends AuditLogDeleteArgs>(args: SelectSubset<T, AuditLogDeleteArgs<ExtArgs>>): Prisma__AuditLogClient<$Result.GetResult<Prisma.$AuditLogPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one AuditLog.
     * @param {AuditLogUpdateArgs} args - Arguments to update one AuditLog.
     * @example
     * // Update one AuditLog
     * const auditLog = await prisma.auditLog.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends AuditLogUpdateArgs>(args: SelectSubset<T, AuditLogUpdateArgs<ExtArgs>>): Prisma__AuditLogClient<$Result.GetResult<Prisma.$AuditLogPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more AuditLogs.
     * @param {AuditLogDeleteManyArgs} args - Arguments to filter AuditLogs to delete.
     * @example
     * // Delete a few AuditLogs
     * const { count } = await prisma.auditLog.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends AuditLogDeleteManyArgs>(args?: SelectSubset<T, AuditLogDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more AuditLogs.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AuditLogUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many AuditLogs
     * const auditLog = await prisma.auditLog.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends AuditLogUpdateManyArgs>(args: SelectSubset<T, AuditLogUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one AuditLog.
     * @param {AuditLogUpsertArgs} args - Arguments to update or create a AuditLog.
     * @example
     * // Update or create a AuditLog
     * const auditLog = await prisma.auditLog.upsert({
     *   create: {
     *     // ... data to create a AuditLog
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the AuditLog we want to update
     *   }
     * })
     */
    upsert<T extends AuditLogUpsertArgs>(args: SelectSubset<T, AuditLogUpsertArgs<ExtArgs>>): Prisma__AuditLogClient<$Result.GetResult<Prisma.$AuditLogPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of AuditLogs.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AuditLogCountArgs} args - Arguments to filter AuditLogs to count.
     * @example
     * // Count the number of AuditLogs
     * const count = await prisma.auditLog.count({
     *   where: {
     *     // ... the filter for the AuditLogs we want to count
     *   }
     * })
    **/
    count<T extends AuditLogCountArgs>(
      args?: Subset<T, AuditLogCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], AuditLogCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a AuditLog.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AuditLogAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends AuditLogAggregateArgs>(args: Subset<T, AuditLogAggregateArgs>): Prisma.PrismaPromise<GetAuditLogAggregateType<T>>

    /**
     * Group by AuditLog.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AuditLogGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends AuditLogGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: AuditLogGroupByArgs['orderBy'] }
        : { orderBy?: AuditLogGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, AuditLogGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetAuditLogGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the AuditLog model
   */
  readonly fields: AuditLogFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for AuditLog.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__AuditLogClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the AuditLog model
   */ 
  interface AuditLogFieldRefs {
    readonly id: FieldRef<"AuditLog", 'Int'>
    readonly entityType: FieldRef<"AuditLog", 'String'>
    readonly entityId: FieldRef<"AuditLog", 'Int'>
    readonly action: FieldRef<"AuditLog", 'String'>
    readonly changesJson: FieldRef<"AuditLog", 'String'>
    readonly createdAt: FieldRef<"AuditLog", 'DateTime'>
    readonly employeeId: FieldRef<"AuditLog", 'Int'>
  }
    

  // Custom InputTypes
  /**
   * AuditLog findUnique
   */
  export type AuditLogFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AuditLog
     */
    select?: AuditLogSelect<ExtArgs> | null
    /**
     * Filter, which AuditLog to fetch.
     */
    where: AuditLogWhereUniqueInput
  }

  /**
   * AuditLog findUniqueOrThrow
   */
  export type AuditLogFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AuditLog
     */
    select?: AuditLogSelect<ExtArgs> | null
    /**
     * Filter, which AuditLog to fetch.
     */
    where: AuditLogWhereUniqueInput
  }

  /**
   * AuditLog findFirst
   */
  export type AuditLogFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AuditLog
     */
    select?: AuditLogSelect<ExtArgs> | null
    /**
     * Filter, which AuditLog to fetch.
     */
    where?: AuditLogWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AuditLogs to fetch.
     */
    orderBy?: AuditLogOrderByWithRelationInput | AuditLogOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for AuditLogs.
     */
    cursor?: AuditLogWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AuditLogs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AuditLogs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of AuditLogs.
     */
    distinct?: AuditLogScalarFieldEnum | AuditLogScalarFieldEnum[]
  }

  /**
   * AuditLog findFirstOrThrow
   */
  export type AuditLogFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AuditLog
     */
    select?: AuditLogSelect<ExtArgs> | null
    /**
     * Filter, which AuditLog to fetch.
     */
    where?: AuditLogWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AuditLogs to fetch.
     */
    orderBy?: AuditLogOrderByWithRelationInput | AuditLogOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for AuditLogs.
     */
    cursor?: AuditLogWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AuditLogs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AuditLogs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of AuditLogs.
     */
    distinct?: AuditLogScalarFieldEnum | AuditLogScalarFieldEnum[]
  }

  /**
   * AuditLog findMany
   */
  export type AuditLogFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AuditLog
     */
    select?: AuditLogSelect<ExtArgs> | null
    /**
     * Filter, which AuditLogs to fetch.
     */
    where?: AuditLogWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AuditLogs to fetch.
     */
    orderBy?: AuditLogOrderByWithRelationInput | AuditLogOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing AuditLogs.
     */
    cursor?: AuditLogWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AuditLogs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AuditLogs.
     */
    skip?: number
    distinct?: AuditLogScalarFieldEnum | AuditLogScalarFieldEnum[]
  }

  /**
   * AuditLog create
   */
  export type AuditLogCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AuditLog
     */
    select?: AuditLogSelect<ExtArgs> | null
    /**
     * The data needed to create a AuditLog.
     */
    data: XOR<AuditLogCreateInput, AuditLogUncheckedCreateInput>
  }

  /**
   * AuditLog createMany
   */
  export type AuditLogCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many AuditLogs.
     */
    data: AuditLogCreateManyInput | AuditLogCreateManyInput[]
  }

  /**
   * AuditLog createManyAndReturn
   */
  export type AuditLogCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AuditLog
     */
    select?: AuditLogSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many AuditLogs.
     */
    data: AuditLogCreateManyInput | AuditLogCreateManyInput[]
  }

  /**
   * AuditLog update
   */
  export type AuditLogUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AuditLog
     */
    select?: AuditLogSelect<ExtArgs> | null
    /**
     * The data needed to update a AuditLog.
     */
    data: XOR<AuditLogUpdateInput, AuditLogUncheckedUpdateInput>
    /**
     * Choose, which AuditLog to update.
     */
    where: AuditLogWhereUniqueInput
  }

  /**
   * AuditLog updateMany
   */
  export type AuditLogUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update AuditLogs.
     */
    data: XOR<AuditLogUpdateManyMutationInput, AuditLogUncheckedUpdateManyInput>
    /**
     * Filter which AuditLogs to update
     */
    where?: AuditLogWhereInput
  }

  /**
   * AuditLog upsert
   */
  export type AuditLogUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AuditLog
     */
    select?: AuditLogSelect<ExtArgs> | null
    /**
     * The filter to search for the AuditLog to update in case it exists.
     */
    where: AuditLogWhereUniqueInput
    /**
     * In case the AuditLog found by the `where` argument doesn't exist, create a new AuditLog with this data.
     */
    create: XOR<AuditLogCreateInput, AuditLogUncheckedCreateInput>
    /**
     * In case the AuditLog was found with the provided `where` argument, update it with this data.
     */
    update: XOR<AuditLogUpdateInput, AuditLogUncheckedUpdateInput>
  }

  /**
   * AuditLog delete
   */
  export type AuditLogDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AuditLog
     */
    select?: AuditLogSelect<ExtArgs> | null
    /**
     * Filter which AuditLog to delete.
     */
    where: AuditLogWhereUniqueInput
  }

  /**
   * AuditLog deleteMany
   */
  export type AuditLogDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which AuditLogs to delete
     */
    where?: AuditLogWhereInput
  }

  /**
   * AuditLog without action
   */
  export type AuditLogDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AuditLog
     */
    select?: AuditLogSelect<ExtArgs> | null
  }


  /**
   * Model Employee
   */

  export type AggregateEmployee = {
    _count: EmployeeCountAggregateOutputType | null
    _avg: EmployeeAvgAggregateOutputType | null
    _sum: EmployeeSumAggregateOutputType | null
    _min: EmployeeMinAggregateOutputType | null
    _max: EmployeeMaxAggregateOutputType | null
  }

  export type EmployeeAvgAggregateOutputType = {
    id: number | null
    roleId: number | null
    hourlyWage: number | null
  }

  export type EmployeeSumAggregateOutputType = {
    id: number | null
    roleId: number | null
    hourlyWage: number | null
  }

  export type EmployeeMinAggregateOutputType = {
    id: number | null
    firstName: string | null
    lastName: string | null
    phone1: string | null
    phone2: string | null
    city: string | null
    street: string | null
    houseNum: string | null
    email: string | null
    joinDate: Date | null
    fullName: string | null
    notes: string | null
    emailSuffix: string | null
    roleId: number | null
    password: string | null
    isActive: boolean | null
    hourlyWage: number | null
    paymentMethod: string | null
    travelExpenses: boolean | null
  }

  export type EmployeeMaxAggregateOutputType = {
    id: number | null
    firstName: string | null
    lastName: string | null
    phone1: string | null
    phone2: string | null
    city: string | null
    street: string | null
    houseNum: string | null
    email: string | null
    joinDate: Date | null
    fullName: string | null
    notes: string | null
    emailSuffix: string | null
    roleId: number | null
    password: string | null
    isActive: boolean | null
    hourlyWage: number | null
    paymentMethod: string | null
    travelExpenses: boolean | null
  }

  export type EmployeeCountAggregateOutputType = {
    id: number
    firstName: number
    lastName: number
    phone1: number
    phone2: number
    city: number
    street: number
    houseNum: number
    email: number
    joinDate: number
    fullName: number
    notes: number
    emailSuffix: number
    roleId: number
    password: number
    isActive: number
    hourlyWage: number
    paymentMethod: number
    travelExpenses: number
    _all: number
  }


  export type EmployeeAvgAggregateInputType = {
    id?: true
    roleId?: true
    hourlyWage?: true
  }

  export type EmployeeSumAggregateInputType = {
    id?: true
    roleId?: true
    hourlyWage?: true
  }

  export type EmployeeMinAggregateInputType = {
    id?: true
    firstName?: true
    lastName?: true
    phone1?: true
    phone2?: true
    city?: true
    street?: true
    houseNum?: true
    email?: true
    joinDate?: true
    fullName?: true
    notes?: true
    emailSuffix?: true
    roleId?: true
    password?: true
    isActive?: true
    hourlyWage?: true
    paymentMethod?: true
    travelExpenses?: true
  }

  export type EmployeeMaxAggregateInputType = {
    id?: true
    firstName?: true
    lastName?: true
    phone1?: true
    phone2?: true
    city?: true
    street?: true
    houseNum?: true
    email?: true
    joinDate?: true
    fullName?: true
    notes?: true
    emailSuffix?: true
    roleId?: true
    password?: true
    isActive?: true
    hourlyWage?: true
    paymentMethod?: true
    travelExpenses?: true
  }

  export type EmployeeCountAggregateInputType = {
    id?: true
    firstName?: true
    lastName?: true
    phone1?: true
    phone2?: true
    city?: true
    street?: true
    houseNum?: true
    email?: true
    joinDate?: true
    fullName?: true
    notes?: true
    emailSuffix?: true
    roleId?: true
    password?: true
    isActive?: true
    hourlyWage?: true
    paymentMethod?: true
    travelExpenses?: true
    _all?: true
  }

  export type EmployeeAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Employee to aggregate.
     */
    where?: EmployeeWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Employees to fetch.
     */
    orderBy?: EmployeeOrderByWithRelationInput | EmployeeOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: EmployeeWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Employees from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Employees.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Employees
    **/
    _count?: true | EmployeeCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: EmployeeAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: EmployeeSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: EmployeeMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: EmployeeMaxAggregateInputType
  }

  export type GetEmployeeAggregateType<T extends EmployeeAggregateArgs> = {
        [P in keyof T & keyof AggregateEmployee]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateEmployee[P]>
      : GetScalarType<T[P], AggregateEmployee[P]>
  }




  export type EmployeeGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: EmployeeWhereInput
    orderBy?: EmployeeOrderByWithAggregationInput | EmployeeOrderByWithAggregationInput[]
    by: EmployeeScalarFieldEnum[] | EmployeeScalarFieldEnum
    having?: EmployeeScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: EmployeeCountAggregateInputType | true
    _avg?: EmployeeAvgAggregateInputType
    _sum?: EmployeeSumAggregateInputType
    _min?: EmployeeMinAggregateInputType
    _max?: EmployeeMaxAggregateInputType
  }

  export type EmployeeGroupByOutputType = {
    id: number
    firstName: string | null
    lastName: string | null
    phone1: string | null
    phone2: string | null
    city: string | null
    street: string | null
    houseNum: string | null
    email: string | null
    joinDate: Date | null
    fullName: string | null
    notes: string | null
    emailSuffix: string | null
    roleId: number | null
    password: string | null
    isActive: boolean
    hourlyWage: number | null
    paymentMethod: string | null
    travelExpenses: boolean | null
    _count: EmployeeCountAggregateOutputType | null
    _avg: EmployeeAvgAggregateOutputType | null
    _sum: EmployeeSumAggregateOutputType | null
    _min: EmployeeMinAggregateOutputType | null
    _max: EmployeeMaxAggregateOutputType | null
  }

  type GetEmployeeGroupByPayload<T extends EmployeeGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<EmployeeGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof EmployeeGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], EmployeeGroupByOutputType[P]>
            : GetScalarType<T[P], EmployeeGroupByOutputType[P]>
        }
      >
    >


  export type EmployeeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    firstName?: boolean
    lastName?: boolean
    phone1?: boolean
    phone2?: boolean
    city?: boolean
    street?: boolean
    houseNum?: boolean
    email?: boolean
    joinDate?: boolean
    fullName?: boolean
    notes?: boolean
    emailSuffix?: boolean
    roleId?: boolean
    password?: boolean
    isActive?: boolean
    hourlyWage?: boolean
    paymentMethod?: boolean
    travelExpenses?: boolean
    pageVisits?: boolean | Employee$pageVisitsArgs<ExtArgs>
    shifts?: boolean | Employee$shiftsArgs<ExtArgs>
    _count?: boolean | EmployeeCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["employee"]>

  export type EmployeeSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    firstName?: boolean
    lastName?: boolean
    phone1?: boolean
    phone2?: boolean
    city?: boolean
    street?: boolean
    houseNum?: boolean
    email?: boolean
    joinDate?: boolean
    fullName?: boolean
    notes?: boolean
    emailSuffix?: boolean
    roleId?: boolean
    password?: boolean
    isActive?: boolean
    hourlyWage?: boolean
    paymentMethod?: boolean
    travelExpenses?: boolean
  }, ExtArgs["result"]["employee"]>

  export type EmployeeSelectScalar = {
    id?: boolean
    firstName?: boolean
    lastName?: boolean
    phone1?: boolean
    phone2?: boolean
    city?: boolean
    street?: boolean
    houseNum?: boolean
    email?: boolean
    joinDate?: boolean
    fullName?: boolean
    notes?: boolean
    emailSuffix?: boolean
    roleId?: boolean
    password?: boolean
    isActive?: boolean
    hourlyWage?: boolean
    paymentMethod?: boolean
    travelExpenses?: boolean
  }

  export type EmployeeInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    pageVisits?: boolean | Employee$pageVisitsArgs<ExtArgs>
    shifts?: boolean | Employee$shiftsArgs<ExtArgs>
    _count?: boolean | EmployeeCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type EmployeeIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $EmployeePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Employee"
    objects: {
      pageVisits: Prisma.$PageVisitLogPayload<ExtArgs>[]
      shifts: Prisma.$ShiftPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: number
      firstName: string | null
      lastName: string | null
      phone1: string | null
      phone2: string | null
      city: string | null
      street: string | null
      houseNum: string | null
      email: string | null
      joinDate: Date | null
      fullName: string | null
      notes: string | null
      emailSuffix: string | null
      roleId: number | null
      password: string | null
      isActive: boolean
      hourlyWage: number | null
      paymentMethod: string | null
      travelExpenses: boolean | null
    }, ExtArgs["result"]["employee"]>
    composites: {}
  }

  type EmployeeGetPayload<S extends boolean | null | undefined | EmployeeDefaultArgs> = $Result.GetResult<Prisma.$EmployeePayload, S>

  type EmployeeCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<EmployeeFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: EmployeeCountAggregateInputType | true
    }

  export interface EmployeeDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Employee'], meta: { name: 'Employee' } }
    /**
     * Find zero or one Employee that matches the filter.
     * @param {EmployeeFindUniqueArgs} args - Arguments to find a Employee
     * @example
     * // Get one Employee
     * const employee = await prisma.employee.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends EmployeeFindUniqueArgs>(args: SelectSubset<T, EmployeeFindUniqueArgs<ExtArgs>>): Prisma__EmployeeClient<$Result.GetResult<Prisma.$EmployeePayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one Employee that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {EmployeeFindUniqueOrThrowArgs} args - Arguments to find a Employee
     * @example
     * // Get one Employee
     * const employee = await prisma.employee.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends EmployeeFindUniqueOrThrowArgs>(args: SelectSubset<T, EmployeeFindUniqueOrThrowArgs<ExtArgs>>): Prisma__EmployeeClient<$Result.GetResult<Prisma.$EmployeePayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first Employee that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EmployeeFindFirstArgs} args - Arguments to find a Employee
     * @example
     * // Get one Employee
     * const employee = await prisma.employee.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends EmployeeFindFirstArgs>(args?: SelectSubset<T, EmployeeFindFirstArgs<ExtArgs>>): Prisma__EmployeeClient<$Result.GetResult<Prisma.$EmployeePayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first Employee that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EmployeeFindFirstOrThrowArgs} args - Arguments to find a Employee
     * @example
     * // Get one Employee
     * const employee = await prisma.employee.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends EmployeeFindFirstOrThrowArgs>(args?: SelectSubset<T, EmployeeFindFirstOrThrowArgs<ExtArgs>>): Prisma__EmployeeClient<$Result.GetResult<Prisma.$EmployeePayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more Employees that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EmployeeFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Employees
     * const employees = await prisma.employee.findMany()
     * 
     * // Get first 10 Employees
     * const employees = await prisma.employee.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const employeeWithIdOnly = await prisma.employee.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends EmployeeFindManyArgs>(args?: SelectSubset<T, EmployeeFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$EmployeePayload<ExtArgs>, T, "findMany">>

    /**
     * Create a Employee.
     * @param {EmployeeCreateArgs} args - Arguments to create a Employee.
     * @example
     * // Create one Employee
     * const Employee = await prisma.employee.create({
     *   data: {
     *     // ... data to create a Employee
     *   }
     * })
     * 
     */
    create<T extends EmployeeCreateArgs>(args: SelectSubset<T, EmployeeCreateArgs<ExtArgs>>): Prisma__EmployeeClient<$Result.GetResult<Prisma.$EmployeePayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many Employees.
     * @param {EmployeeCreateManyArgs} args - Arguments to create many Employees.
     * @example
     * // Create many Employees
     * const employee = await prisma.employee.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends EmployeeCreateManyArgs>(args?: SelectSubset<T, EmployeeCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Employees and returns the data saved in the database.
     * @param {EmployeeCreateManyAndReturnArgs} args - Arguments to create many Employees.
     * @example
     * // Create many Employees
     * const employee = await prisma.employee.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Employees and only return the `id`
     * const employeeWithIdOnly = await prisma.employee.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends EmployeeCreateManyAndReturnArgs>(args?: SelectSubset<T, EmployeeCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$EmployeePayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a Employee.
     * @param {EmployeeDeleteArgs} args - Arguments to delete one Employee.
     * @example
     * // Delete one Employee
     * const Employee = await prisma.employee.delete({
     *   where: {
     *     // ... filter to delete one Employee
     *   }
     * })
     * 
     */
    delete<T extends EmployeeDeleteArgs>(args: SelectSubset<T, EmployeeDeleteArgs<ExtArgs>>): Prisma__EmployeeClient<$Result.GetResult<Prisma.$EmployeePayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one Employee.
     * @param {EmployeeUpdateArgs} args - Arguments to update one Employee.
     * @example
     * // Update one Employee
     * const employee = await prisma.employee.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends EmployeeUpdateArgs>(args: SelectSubset<T, EmployeeUpdateArgs<ExtArgs>>): Prisma__EmployeeClient<$Result.GetResult<Prisma.$EmployeePayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more Employees.
     * @param {EmployeeDeleteManyArgs} args - Arguments to filter Employees to delete.
     * @example
     * // Delete a few Employees
     * const { count } = await prisma.employee.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends EmployeeDeleteManyArgs>(args?: SelectSubset<T, EmployeeDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Employees.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EmployeeUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Employees
     * const employee = await prisma.employee.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends EmployeeUpdateManyArgs>(args: SelectSubset<T, EmployeeUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one Employee.
     * @param {EmployeeUpsertArgs} args - Arguments to update or create a Employee.
     * @example
     * // Update or create a Employee
     * const employee = await prisma.employee.upsert({
     *   create: {
     *     // ... data to create a Employee
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Employee we want to update
     *   }
     * })
     */
    upsert<T extends EmployeeUpsertArgs>(args: SelectSubset<T, EmployeeUpsertArgs<ExtArgs>>): Prisma__EmployeeClient<$Result.GetResult<Prisma.$EmployeePayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of Employees.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EmployeeCountArgs} args - Arguments to filter Employees to count.
     * @example
     * // Count the number of Employees
     * const count = await prisma.employee.count({
     *   where: {
     *     // ... the filter for the Employees we want to count
     *   }
     * })
    **/
    count<T extends EmployeeCountArgs>(
      args?: Subset<T, EmployeeCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], EmployeeCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Employee.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EmployeeAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends EmployeeAggregateArgs>(args: Subset<T, EmployeeAggregateArgs>): Prisma.PrismaPromise<GetEmployeeAggregateType<T>>

    /**
     * Group by Employee.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EmployeeGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends EmployeeGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: EmployeeGroupByArgs['orderBy'] }
        : { orderBy?: EmployeeGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, EmployeeGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetEmployeeGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Employee model
   */
  readonly fields: EmployeeFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Employee.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__EmployeeClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    pageVisits<T extends Employee$pageVisitsArgs<ExtArgs> = {}>(args?: Subset<T, Employee$pageVisitsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PageVisitLogPayload<ExtArgs>, T, "findMany"> | Null>
    shifts<T extends Employee$shiftsArgs<ExtArgs> = {}>(args?: Subset<T, Employee$shiftsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ShiftPayload<ExtArgs>, T, "findMany"> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Employee model
   */ 
  interface EmployeeFieldRefs {
    readonly id: FieldRef<"Employee", 'Int'>
    readonly firstName: FieldRef<"Employee", 'String'>
    readonly lastName: FieldRef<"Employee", 'String'>
    readonly phone1: FieldRef<"Employee", 'String'>
    readonly phone2: FieldRef<"Employee", 'String'>
    readonly city: FieldRef<"Employee", 'String'>
    readonly street: FieldRef<"Employee", 'String'>
    readonly houseNum: FieldRef<"Employee", 'String'>
    readonly email: FieldRef<"Employee", 'String'>
    readonly joinDate: FieldRef<"Employee", 'DateTime'>
    readonly fullName: FieldRef<"Employee", 'String'>
    readonly notes: FieldRef<"Employee", 'String'>
    readonly emailSuffix: FieldRef<"Employee", 'String'>
    readonly roleId: FieldRef<"Employee", 'Int'>
    readonly password: FieldRef<"Employee", 'String'>
    readonly isActive: FieldRef<"Employee", 'Boolean'>
    readonly hourlyWage: FieldRef<"Employee", 'Float'>
    readonly paymentMethod: FieldRef<"Employee", 'String'>
    readonly travelExpenses: FieldRef<"Employee", 'Boolean'>
  }
    

  // Custom InputTypes
  /**
   * Employee findUnique
   */
  export type EmployeeFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Employee
     */
    select?: EmployeeSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EmployeeInclude<ExtArgs> | null
    /**
     * Filter, which Employee to fetch.
     */
    where: EmployeeWhereUniqueInput
  }

  /**
   * Employee findUniqueOrThrow
   */
  export type EmployeeFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Employee
     */
    select?: EmployeeSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EmployeeInclude<ExtArgs> | null
    /**
     * Filter, which Employee to fetch.
     */
    where: EmployeeWhereUniqueInput
  }

  /**
   * Employee findFirst
   */
  export type EmployeeFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Employee
     */
    select?: EmployeeSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EmployeeInclude<ExtArgs> | null
    /**
     * Filter, which Employee to fetch.
     */
    where?: EmployeeWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Employees to fetch.
     */
    orderBy?: EmployeeOrderByWithRelationInput | EmployeeOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Employees.
     */
    cursor?: EmployeeWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Employees from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Employees.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Employees.
     */
    distinct?: EmployeeScalarFieldEnum | EmployeeScalarFieldEnum[]
  }

  /**
   * Employee findFirstOrThrow
   */
  export type EmployeeFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Employee
     */
    select?: EmployeeSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EmployeeInclude<ExtArgs> | null
    /**
     * Filter, which Employee to fetch.
     */
    where?: EmployeeWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Employees to fetch.
     */
    orderBy?: EmployeeOrderByWithRelationInput | EmployeeOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Employees.
     */
    cursor?: EmployeeWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Employees from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Employees.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Employees.
     */
    distinct?: EmployeeScalarFieldEnum | EmployeeScalarFieldEnum[]
  }

  /**
   * Employee findMany
   */
  export type EmployeeFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Employee
     */
    select?: EmployeeSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EmployeeInclude<ExtArgs> | null
    /**
     * Filter, which Employees to fetch.
     */
    where?: EmployeeWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Employees to fetch.
     */
    orderBy?: EmployeeOrderByWithRelationInput | EmployeeOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Employees.
     */
    cursor?: EmployeeWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Employees from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Employees.
     */
    skip?: number
    distinct?: EmployeeScalarFieldEnum | EmployeeScalarFieldEnum[]
  }

  /**
   * Employee create
   */
  export type EmployeeCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Employee
     */
    select?: EmployeeSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EmployeeInclude<ExtArgs> | null
    /**
     * The data needed to create a Employee.
     */
    data?: XOR<EmployeeCreateInput, EmployeeUncheckedCreateInput>
  }

  /**
   * Employee createMany
   */
  export type EmployeeCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Employees.
     */
    data: EmployeeCreateManyInput | EmployeeCreateManyInput[]
  }

  /**
   * Employee createManyAndReturn
   */
  export type EmployeeCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Employee
     */
    select?: EmployeeSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many Employees.
     */
    data: EmployeeCreateManyInput | EmployeeCreateManyInput[]
  }

  /**
   * Employee update
   */
  export type EmployeeUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Employee
     */
    select?: EmployeeSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EmployeeInclude<ExtArgs> | null
    /**
     * The data needed to update a Employee.
     */
    data: XOR<EmployeeUpdateInput, EmployeeUncheckedUpdateInput>
    /**
     * Choose, which Employee to update.
     */
    where: EmployeeWhereUniqueInput
  }

  /**
   * Employee updateMany
   */
  export type EmployeeUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Employees.
     */
    data: XOR<EmployeeUpdateManyMutationInput, EmployeeUncheckedUpdateManyInput>
    /**
     * Filter which Employees to update
     */
    where?: EmployeeWhereInput
  }

  /**
   * Employee upsert
   */
  export type EmployeeUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Employee
     */
    select?: EmployeeSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EmployeeInclude<ExtArgs> | null
    /**
     * The filter to search for the Employee to update in case it exists.
     */
    where: EmployeeWhereUniqueInput
    /**
     * In case the Employee found by the `where` argument doesn't exist, create a new Employee with this data.
     */
    create: XOR<EmployeeCreateInput, EmployeeUncheckedCreateInput>
    /**
     * In case the Employee was found with the provided `where` argument, update it with this data.
     */
    update: XOR<EmployeeUpdateInput, EmployeeUncheckedUpdateInput>
  }

  /**
   * Employee delete
   */
  export type EmployeeDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Employee
     */
    select?: EmployeeSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EmployeeInclude<ExtArgs> | null
    /**
     * Filter which Employee to delete.
     */
    where: EmployeeWhereUniqueInput
  }

  /**
   * Employee deleteMany
   */
  export type EmployeeDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Employees to delete
     */
    where?: EmployeeWhereInput
  }

  /**
   * Employee.pageVisits
   */
  export type Employee$pageVisitsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PageVisitLog
     */
    select?: PageVisitLogSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PageVisitLogInclude<ExtArgs> | null
    where?: PageVisitLogWhereInput
    orderBy?: PageVisitLogOrderByWithRelationInput | PageVisitLogOrderByWithRelationInput[]
    cursor?: PageVisitLogWhereUniqueInput
    take?: number
    skip?: number
    distinct?: PageVisitLogScalarFieldEnum | PageVisitLogScalarFieldEnum[]
  }

  /**
   * Employee.shifts
   */
  export type Employee$shiftsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Shift
     */
    select?: ShiftSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ShiftInclude<ExtArgs> | null
    where?: ShiftWhereInput
    orderBy?: ShiftOrderByWithRelationInput | ShiftOrderByWithRelationInput[]
    cursor?: ShiftWhereUniqueInput
    take?: number
    skip?: number
    distinct?: ShiftScalarFieldEnum | ShiftScalarFieldEnum[]
  }

  /**
   * Employee without action
   */
  export type EmployeeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Employee
     */
    select?: EmployeeSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EmployeeInclude<ExtArgs> | null
  }


  /**
   * Model Shift
   */

  export type AggregateShift = {
    _count: ShiftCountAggregateOutputType | null
    _avg: ShiftAvgAggregateOutputType | null
    _sum: ShiftSumAggregateOutputType | null
    _min: ShiftMinAggregateOutputType | null
    _max: ShiftMaxAggregateOutputType | null
  }

  export type ShiftAvgAggregateOutputType = {
    id: number | null
    employeeId: number | null
    totalMinutes: number | null
    hourlyWageSnapshot: number | null
    travelExpensesSnapshot: number | null
    totalCalculated: number | null
  }

  export type ShiftSumAggregateOutputType = {
    id: number | null
    employeeId: number | null
    totalMinutes: number | null
    hourlyWageSnapshot: number | null
    travelExpensesSnapshot: number | null
    totalCalculated: number | null
  }

  export type ShiftMinAggregateOutputType = {
    id: number | null
    employeeId: number | null
    entryTime: Date | null
    exitTime: Date | null
    hebrewDate: string | null
    date: Date | null
    totalMinutes: number | null
    hourlyWageSnapshot: number | null
    travelExpensesSnapshot: number | null
    totalCalculated: number | null
    paymentMethod: string | null
    notes: string | null
    isDeleted: boolean | null
  }

  export type ShiftMaxAggregateOutputType = {
    id: number | null
    employeeId: number | null
    entryTime: Date | null
    exitTime: Date | null
    hebrewDate: string | null
    date: Date | null
    totalMinutes: number | null
    hourlyWageSnapshot: number | null
    travelExpensesSnapshot: number | null
    totalCalculated: number | null
    paymentMethod: string | null
    notes: string | null
    isDeleted: boolean | null
  }

  export type ShiftCountAggregateOutputType = {
    id: number
    employeeId: number
    entryTime: number
    exitTime: number
    hebrewDate: number
    date: number
    totalMinutes: number
    hourlyWageSnapshot: number
    travelExpensesSnapshot: number
    totalCalculated: number
    paymentMethod: number
    notes: number
    isDeleted: number
    _all: number
  }


  export type ShiftAvgAggregateInputType = {
    id?: true
    employeeId?: true
    totalMinutes?: true
    hourlyWageSnapshot?: true
    travelExpensesSnapshot?: true
    totalCalculated?: true
  }

  export type ShiftSumAggregateInputType = {
    id?: true
    employeeId?: true
    totalMinutes?: true
    hourlyWageSnapshot?: true
    travelExpensesSnapshot?: true
    totalCalculated?: true
  }

  export type ShiftMinAggregateInputType = {
    id?: true
    employeeId?: true
    entryTime?: true
    exitTime?: true
    hebrewDate?: true
    date?: true
    totalMinutes?: true
    hourlyWageSnapshot?: true
    travelExpensesSnapshot?: true
    totalCalculated?: true
    paymentMethod?: true
    notes?: true
    isDeleted?: true
  }

  export type ShiftMaxAggregateInputType = {
    id?: true
    employeeId?: true
    entryTime?: true
    exitTime?: true
    hebrewDate?: true
    date?: true
    totalMinutes?: true
    hourlyWageSnapshot?: true
    travelExpensesSnapshot?: true
    totalCalculated?: true
    paymentMethod?: true
    notes?: true
    isDeleted?: true
  }

  export type ShiftCountAggregateInputType = {
    id?: true
    employeeId?: true
    entryTime?: true
    exitTime?: true
    hebrewDate?: true
    date?: true
    totalMinutes?: true
    hourlyWageSnapshot?: true
    travelExpensesSnapshot?: true
    totalCalculated?: true
    paymentMethod?: true
    notes?: true
    isDeleted?: true
    _all?: true
  }

  export type ShiftAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Shift to aggregate.
     */
    where?: ShiftWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Shifts to fetch.
     */
    orderBy?: ShiftOrderByWithRelationInput | ShiftOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: ShiftWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Shifts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Shifts.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Shifts
    **/
    _count?: true | ShiftCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: ShiftAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: ShiftSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: ShiftMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: ShiftMaxAggregateInputType
  }

  export type GetShiftAggregateType<T extends ShiftAggregateArgs> = {
        [P in keyof T & keyof AggregateShift]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateShift[P]>
      : GetScalarType<T[P], AggregateShift[P]>
  }




  export type ShiftGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ShiftWhereInput
    orderBy?: ShiftOrderByWithAggregationInput | ShiftOrderByWithAggregationInput[]
    by: ShiftScalarFieldEnum[] | ShiftScalarFieldEnum
    having?: ShiftScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: ShiftCountAggregateInputType | true
    _avg?: ShiftAvgAggregateInputType
    _sum?: ShiftSumAggregateInputType
    _min?: ShiftMinAggregateInputType
    _max?: ShiftMaxAggregateInputType
  }

  export type ShiftGroupByOutputType = {
    id: number
    employeeId: number
    entryTime: Date | null
    exitTime: Date | null
    hebrewDate: string | null
    date: Date | null
    totalMinutes: number | null
    hourlyWageSnapshot: number | null
    travelExpensesSnapshot: number | null
    totalCalculated: number | null
    paymentMethod: string | null
    notes: string | null
    isDeleted: boolean
    _count: ShiftCountAggregateOutputType | null
    _avg: ShiftAvgAggregateOutputType | null
    _sum: ShiftSumAggregateOutputType | null
    _min: ShiftMinAggregateOutputType | null
    _max: ShiftMaxAggregateOutputType | null
  }

  type GetShiftGroupByPayload<T extends ShiftGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<ShiftGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof ShiftGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], ShiftGroupByOutputType[P]>
            : GetScalarType<T[P], ShiftGroupByOutputType[P]>
        }
      >
    >


  export type ShiftSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    employeeId?: boolean
    entryTime?: boolean
    exitTime?: boolean
    hebrewDate?: boolean
    date?: boolean
    totalMinutes?: boolean
    hourlyWageSnapshot?: boolean
    travelExpensesSnapshot?: boolean
    totalCalculated?: boolean
    paymentMethod?: boolean
    notes?: boolean
    isDeleted?: boolean
    employee?: boolean | EmployeeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["shift"]>

  export type ShiftSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    employeeId?: boolean
    entryTime?: boolean
    exitTime?: boolean
    hebrewDate?: boolean
    date?: boolean
    totalMinutes?: boolean
    hourlyWageSnapshot?: boolean
    travelExpensesSnapshot?: boolean
    totalCalculated?: boolean
    paymentMethod?: boolean
    notes?: boolean
    isDeleted?: boolean
    employee?: boolean | EmployeeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["shift"]>

  export type ShiftSelectScalar = {
    id?: boolean
    employeeId?: boolean
    entryTime?: boolean
    exitTime?: boolean
    hebrewDate?: boolean
    date?: boolean
    totalMinutes?: boolean
    hourlyWageSnapshot?: boolean
    travelExpensesSnapshot?: boolean
    totalCalculated?: boolean
    paymentMethod?: boolean
    notes?: boolean
    isDeleted?: boolean
  }

  export type ShiftInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    employee?: boolean | EmployeeDefaultArgs<ExtArgs>
  }
  export type ShiftIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    employee?: boolean | EmployeeDefaultArgs<ExtArgs>
  }

  export type $ShiftPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Shift"
    objects: {
      employee: Prisma.$EmployeePayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: number
      employeeId: number
      entryTime: Date | null
      exitTime: Date | null
      hebrewDate: string | null
      date: Date | null
      totalMinutes: number | null
      hourlyWageSnapshot: number | null
      travelExpensesSnapshot: number | null
      totalCalculated: number | null
      paymentMethod: string | null
      notes: string | null
      isDeleted: boolean
    }, ExtArgs["result"]["shift"]>
    composites: {}
  }

  type ShiftGetPayload<S extends boolean | null | undefined | ShiftDefaultArgs> = $Result.GetResult<Prisma.$ShiftPayload, S>

  type ShiftCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<ShiftFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: ShiftCountAggregateInputType | true
    }

  export interface ShiftDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Shift'], meta: { name: 'Shift' } }
    /**
     * Find zero or one Shift that matches the filter.
     * @param {ShiftFindUniqueArgs} args - Arguments to find a Shift
     * @example
     * // Get one Shift
     * const shift = await prisma.shift.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends ShiftFindUniqueArgs>(args: SelectSubset<T, ShiftFindUniqueArgs<ExtArgs>>): Prisma__ShiftClient<$Result.GetResult<Prisma.$ShiftPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one Shift that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {ShiftFindUniqueOrThrowArgs} args - Arguments to find a Shift
     * @example
     * // Get one Shift
     * const shift = await prisma.shift.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends ShiftFindUniqueOrThrowArgs>(args: SelectSubset<T, ShiftFindUniqueOrThrowArgs<ExtArgs>>): Prisma__ShiftClient<$Result.GetResult<Prisma.$ShiftPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first Shift that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ShiftFindFirstArgs} args - Arguments to find a Shift
     * @example
     * // Get one Shift
     * const shift = await prisma.shift.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends ShiftFindFirstArgs>(args?: SelectSubset<T, ShiftFindFirstArgs<ExtArgs>>): Prisma__ShiftClient<$Result.GetResult<Prisma.$ShiftPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first Shift that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ShiftFindFirstOrThrowArgs} args - Arguments to find a Shift
     * @example
     * // Get one Shift
     * const shift = await prisma.shift.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends ShiftFindFirstOrThrowArgs>(args?: SelectSubset<T, ShiftFindFirstOrThrowArgs<ExtArgs>>): Prisma__ShiftClient<$Result.GetResult<Prisma.$ShiftPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more Shifts that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ShiftFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Shifts
     * const shifts = await prisma.shift.findMany()
     * 
     * // Get first 10 Shifts
     * const shifts = await prisma.shift.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const shiftWithIdOnly = await prisma.shift.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends ShiftFindManyArgs>(args?: SelectSubset<T, ShiftFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ShiftPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a Shift.
     * @param {ShiftCreateArgs} args - Arguments to create a Shift.
     * @example
     * // Create one Shift
     * const Shift = await prisma.shift.create({
     *   data: {
     *     // ... data to create a Shift
     *   }
     * })
     * 
     */
    create<T extends ShiftCreateArgs>(args: SelectSubset<T, ShiftCreateArgs<ExtArgs>>): Prisma__ShiftClient<$Result.GetResult<Prisma.$ShiftPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many Shifts.
     * @param {ShiftCreateManyArgs} args - Arguments to create many Shifts.
     * @example
     * // Create many Shifts
     * const shift = await prisma.shift.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends ShiftCreateManyArgs>(args?: SelectSubset<T, ShiftCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Shifts and returns the data saved in the database.
     * @param {ShiftCreateManyAndReturnArgs} args - Arguments to create many Shifts.
     * @example
     * // Create many Shifts
     * const shift = await prisma.shift.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Shifts and only return the `id`
     * const shiftWithIdOnly = await prisma.shift.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends ShiftCreateManyAndReturnArgs>(args?: SelectSubset<T, ShiftCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ShiftPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a Shift.
     * @param {ShiftDeleteArgs} args - Arguments to delete one Shift.
     * @example
     * // Delete one Shift
     * const Shift = await prisma.shift.delete({
     *   where: {
     *     // ... filter to delete one Shift
     *   }
     * })
     * 
     */
    delete<T extends ShiftDeleteArgs>(args: SelectSubset<T, ShiftDeleteArgs<ExtArgs>>): Prisma__ShiftClient<$Result.GetResult<Prisma.$ShiftPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one Shift.
     * @param {ShiftUpdateArgs} args - Arguments to update one Shift.
     * @example
     * // Update one Shift
     * const shift = await prisma.shift.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends ShiftUpdateArgs>(args: SelectSubset<T, ShiftUpdateArgs<ExtArgs>>): Prisma__ShiftClient<$Result.GetResult<Prisma.$ShiftPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more Shifts.
     * @param {ShiftDeleteManyArgs} args - Arguments to filter Shifts to delete.
     * @example
     * // Delete a few Shifts
     * const { count } = await prisma.shift.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends ShiftDeleteManyArgs>(args?: SelectSubset<T, ShiftDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Shifts.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ShiftUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Shifts
     * const shift = await prisma.shift.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends ShiftUpdateManyArgs>(args: SelectSubset<T, ShiftUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one Shift.
     * @param {ShiftUpsertArgs} args - Arguments to update or create a Shift.
     * @example
     * // Update or create a Shift
     * const shift = await prisma.shift.upsert({
     *   create: {
     *     // ... data to create a Shift
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Shift we want to update
     *   }
     * })
     */
    upsert<T extends ShiftUpsertArgs>(args: SelectSubset<T, ShiftUpsertArgs<ExtArgs>>): Prisma__ShiftClient<$Result.GetResult<Prisma.$ShiftPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of Shifts.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ShiftCountArgs} args - Arguments to filter Shifts to count.
     * @example
     * // Count the number of Shifts
     * const count = await prisma.shift.count({
     *   where: {
     *     // ... the filter for the Shifts we want to count
     *   }
     * })
    **/
    count<T extends ShiftCountArgs>(
      args?: Subset<T, ShiftCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], ShiftCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Shift.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ShiftAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends ShiftAggregateArgs>(args: Subset<T, ShiftAggregateArgs>): Prisma.PrismaPromise<GetShiftAggregateType<T>>

    /**
     * Group by Shift.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ShiftGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends ShiftGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: ShiftGroupByArgs['orderBy'] }
        : { orderBy?: ShiftGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, ShiftGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetShiftGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Shift model
   */
  readonly fields: ShiftFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Shift.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__ShiftClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    employee<T extends EmployeeDefaultArgs<ExtArgs> = {}>(args?: Subset<T, EmployeeDefaultArgs<ExtArgs>>): Prisma__EmployeeClient<$Result.GetResult<Prisma.$EmployeePayload<ExtArgs>, T, "findUniqueOrThrow"> | Null, Null, ExtArgs>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Shift model
   */ 
  interface ShiftFieldRefs {
    readonly id: FieldRef<"Shift", 'Int'>
    readonly employeeId: FieldRef<"Shift", 'Int'>
    readonly entryTime: FieldRef<"Shift", 'DateTime'>
    readonly exitTime: FieldRef<"Shift", 'DateTime'>
    readonly hebrewDate: FieldRef<"Shift", 'String'>
    readonly date: FieldRef<"Shift", 'DateTime'>
    readonly totalMinutes: FieldRef<"Shift", 'Int'>
    readonly hourlyWageSnapshot: FieldRef<"Shift", 'Float'>
    readonly travelExpensesSnapshot: FieldRef<"Shift", 'Float'>
    readonly totalCalculated: FieldRef<"Shift", 'Float'>
    readonly paymentMethod: FieldRef<"Shift", 'String'>
    readonly notes: FieldRef<"Shift", 'String'>
    readonly isDeleted: FieldRef<"Shift", 'Boolean'>
  }
    

  // Custom InputTypes
  /**
   * Shift findUnique
   */
  export type ShiftFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Shift
     */
    select?: ShiftSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ShiftInclude<ExtArgs> | null
    /**
     * Filter, which Shift to fetch.
     */
    where: ShiftWhereUniqueInput
  }

  /**
   * Shift findUniqueOrThrow
   */
  export type ShiftFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Shift
     */
    select?: ShiftSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ShiftInclude<ExtArgs> | null
    /**
     * Filter, which Shift to fetch.
     */
    where: ShiftWhereUniqueInput
  }

  /**
   * Shift findFirst
   */
  export type ShiftFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Shift
     */
    select?: ShiftSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ShiftInclude<ExtArgs> | null
    /**
     * Filter, which Shift to fetch.
     */
    where?: ShiftWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Shifts to fetch.
     */
    orderBy?: ShiftOrderByWithRelationInput | ShiftOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Shifts.
     */
    cursor?: ShiftWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Shifts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Shifts.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Shifts.
     */
    distinct?: ShiftScalarFieldEnum | ShiftScalarFieldEnum[]
  }

  /**
   * Shift findFirstOrThrow
   */
  export type ShiftFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Shift
     */
    select?: ShiftSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ShiftInclude<ExtArgs> | null
    /**
     * Filter, which Shift to fetch.
     */
    where?: ShiftWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Shifts to fetch.
     */
    orderBy?: ShiftOrderByWithRelationInput | ShiftOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Shifts.
     */
    cursor?: ShiftWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Shifts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Shifts.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Shifts.
     */
    distinct?: ShiftScalarFieldEnum | ShiftScalarFieldEnum[]
  }

  /**
   * Shift findMany
   */
  export type ShiftFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Shift
     */
    select?: ShiftSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ShiftInclude<ExtArgs> | null
    /**
     * Filter, which Shifts to fetch.
     */
    where?: ShiftWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Shifts to fetch.
     */
    orderBy?: ShiftOrderByWithRelationInput | ShiftOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Shifts.
     */
    cursor?: ShiftWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Shifts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Shifts.
     */
    skip?: number
    distinct?: ShiftScalarFieldEnum | ShiftScalarFieldEnum[]
  }

  /**
   * Shift create
   */
  export type ShiftCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Shift
     */
    select?: ShiftSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ShiftInclude<ExtArgs> | null
    /**
     * The data needed to create a Shift.
     */
    data: XOR<ShiftCreateInput, ShiftUncheckedCreateInput>
  }

  /**
   * Shift createMany
   */
  export type ShiftCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Shifts.
     */
    data: ShiftCreateManyInput | ShiftCreateManyInput[]
  }

  /**
   * Shift createManyAndReturn
   */
  export type ShiftCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Shift
     */
    select?: ShiftSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many Shifts.
     */
    data: ShiftCreateManyInput | ShiftCreateManyInput[]
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ShiftIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * Shift update
   */
  export type ShiftUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Shift
     */
    select?: ShiftSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ShiftInclude<ExtArgs> | null
    /**
     * The data needed to update a Shift.
     */
    data: XOR<ShiftUpdateInput, ShiftUncheckedUpdateInput>
    /**
     * Choose, which Shift to update.
     */
    where: ShiftWhereUniqueInput
  }

  /**
   * Shift updateMany
   */
  export type ShiftUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Shifts.
     */
    data: XOR<ShiftUpdateManyMutationInput, ShiftUncheckedUpdateManyInput>
    /**
     * Filter which Shifts to update
     */
    where?: ShiftWhereInput
  }

  /**
   * Shift upsert
   */
  export type ShiftUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Shift
     */
    select?: ShiftSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ShiftInclude<ExtArgs> | null
    /**
     * The filter to search for the Shift to update in case it exists.
     */
    where: ShiftWhereUniqueInput
    /**
     * In case the Shift found by the `where` argument doesn't exist, create a new Shift with this data.
     */
    create: XOR<ShiftCreateInput, ShiftUncheckedCreateInput>
    /**
     * In case the Shift was found with the provided `where` argument, update it with this data.
     */
    update: XOR<ShiftUpdateInput, ShiftUncheckedUpdateInput>
  }

  /**
   * Shift delete
   */
  export type ShiftDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Shift
     */
    select?: ShiftSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ShiftInclude<ExtArgs> | null
    /**
     * Filter which Shift to delete.
     */
    where: ShiftWhereUniqueInput
  }

  /**
   * Shift deleteMany
   */
  export type ShiftDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Shifts to delete
     */
    where?: ShiftWhereInput
  }

  /**
   * Shift without action
   */
  export type ShiftDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Shift
     */
    select?: ShiftSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ShiftInclude<ExtArgs> | null
  }


  /**
   * Model DressModel
   */

  export type AggregateDressModel = {
    _count: DressModelCountAggregateOutputType | null
    _avg: DressModelAvgAggregateOutputType | null
    _sum: DressModelSumAggregateOutputType | null
    _min: DressModelMinAggregateOutputType | null
    _max: DressModelMaxAggregateOutputType | null
  }

  export type DressModelAvgAggregateOutputType = {
    id: number | null
    barcodePrefix: number | null
  }

  export type DressModelSumAggregateOutputType = {
    id: number | null
    barcodePrefix: number | null
  }

  export type DressModelMinAggregateOutputType = {
    id: number | null
    name: string | null
    barcodePrefix: number | null
    priceCategory: string | null
    notes: string | null
    inInspection: boolean | null
    imageUrl: string | null
    entryDateToRepo: Date | null
    exitDateFromRepo: Date | null
    isDeleted: boolean | null
    deletedAt: Date | null
  }

  export type DressModelMaxAggregateOutputType = {
    id: number | null
    name: string | null
    barcodePrefix: number | null
    priceCategory: string | null
    notes: string | null
    inInspection: boolean | null
    imageUrl: string | null
    entryDateToRepo: Date | null
    exitDateFromRepo: Date | null
    isDeleted: boolean | null
    deletedAt: Date | null
  }

  export type DressModelCountAggregateOutputType = {
    id: number
    name: number
    barcodePrefix: number
    priceCategory: number
    notes: number
    inInspection: number
    imageUrl: number
    entryDateToRepo: number
    exitDateFromRepo: number
    isDeleted: number
    deletedAt: number
    _all: number
  }


  export type DressModelAvgAggregateInputType = {
    id?: true
    barcodePrefix?: true
  }

  export type DressModelSumAggregateInputType = {
    id?: true
    barcodePrefix?: true
  }

  export type DressModelMinAggregateInputType = {
    id?: true
    name?: true
    barcodePrefix?: true
    priceCategory?: true
    notes?: true
    inInspection?: true
    imageUrl?: true
    entryDateToRepo?: true
    exitDateFromRepo?: true
    isDeleted?: true
    deletedAt?: true
  }

  export type DressModelMaxAggregateInputType = {
    id?: true
    name?: true
    barcodePrefix?: true
    priceCategory?: true
    notes?: true
    inInspection?: true
    imageUrl?: true
    entryDateToRepo?: true
    exitDateFromRepo?: true
    isDeleted?: true
    deletedAt?: true
  }

  export type DressModelCountAggregateInputType = {
    id?: true
    name?: true
    barcodePrefix?: true
    priceCategory?: true
    notes?: true
    inInspection?: true
    imageUrl?: true
    entryDateToRepo?: true
    exitDateFromRepo?: true
    isDeleted?: true
    deletedAt?: true
    _all?: true
  }

  export type DressModelAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which DressModel to aggregate.
     */
    where?: DressModelWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of DressModels to fetch.
     */
    orderBy?: DressModelOrderByWithRelationInput | DressModelOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: DressModelWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` DressModels from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` DressModels.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned DressModels
    **/
    _count?: true | DressModelCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: DressModelAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: DressModelSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: DressModelMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: DressModelMaxAggregateInputType
  }

  export type GetDressModelAggregateType<T extends DressModelAggregateArgs> = {
        [P in keyof T & keyof AggregateDressModel]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateDressModel[P]>
      : GetScalarType<T[P], AggregateDressModel[P]>
  }




  export type DressModelGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: DressModelWhereInput
    orderBy?: DressModelOrderByWithAggregationInput | DressModelOrderByWithAggregationInput[]
    by: DressModelScalarFieldEnum[] | DressModelScalarFieldEnum
    having?: DressModelScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: DressModelCountAggregateInputType | true
    _avg?: DressModelAvgAggregateInputType
    _sum?: DressModelSumAggregateInputType
    _min?: DressModelMinAggregateInputType
    _max?: DressModelMaxAggregateInputType
  }

  export type DressModelGroupByOutputType = {
    id: number
    name: string | null
    barcodePrefix: number | null
    priceCategory: string | null
    notes: string | null
    inInspection: boolean
    imageUrl: string | null
    entryDateToRepo: Date | null
    exitDateFromRepo: Date | null
    isDeleted: boolean
    deletedAt: Date | null
    _count: DressModelCountAggregateOutputType | null
    _avg: DressModelAvgAggregateOutputType | null
    _sum: DressModelSumAggregateOutputType | null
    _min: DressModelMinAggregateOutputType | null
    _max: DressModelMaxAggregateOutputType | null
  }

  type GetDressModelGroupByPayload<T extends DressModelGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<DressModelGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof DressModelGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], DressModelGroupByOutputType[P]>
            : GetScalarType<T[P], DressModelGroupByOutputType[P]>
        }
      >
    >


  export type DressModelSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    barcodePrefix?: boolean
    priceCategory?: boolean
    notes?: boolean
    inInspection?: boolean
    imageUrl?: boolean
    entryDateToRepo?: boolean
    exitDateFromRepo?: boolean
    isDeleted?: boolean
    deletedAt?: boolean
    items?: boolean | DressModel$itemsArgs<ExtArgs>
    _count?: boolean | DressModelCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["dressModel"]>

  export type DressModelSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    barcodePrefix?: boolean
    priceCategory?: boolean
    notes?: boolean
    inInspection?: boolean
    imageUrl?: boolean
    entryDateToRepo?: boolean
    exitDateFromRepo?: boolean
    isDeleted?: boolean
    deletedAt?: boolean
  }, ExtArgs["result"]["dressModel"]>

  export type DressModelSelectScalar = {
    id?: boolean
    name?: boolean
    barcodePrefix?: boolean
    priceCategory?: boolean
    notes?: boolean
    inInspection?: boolean
    imageUrl?: boolean
    entryDateToRepo?: boolean
    exitDateFromRepo?: boolean
    isDeleted?: boolean
    deletedAt?: boolean
  }

  export type DressModelInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    items?: boolean | DressModel$itemsArgs<ExtArgs>
    _count?: boolean | DressModelCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type DressModelIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $DressModelPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "DressModel"
    objects: {
      items: Prisma.$DressItemPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: number
      name: string | null
      barcodePrefix: number | null
      priceCategory: string | null
      notes: string | null
      inInspection: boolean
      imageUrl: string | null
      entryDateToRepo: Date | null
      exitDateFromRepo: Date | null
      isDeleted: boolean
      deletedAt: Date | null
    }, ExtArgs["result"]["dressModel"]>
    composites: {}
  }

  type DressModelGetPayload<S extends boolean | null | undefined | DressModelDefaultArgs> = $Result.GetResult<Prisma.$DressModelPayload, S>

  type DressModelCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<DressModelFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: DressModelCountAggregateInputType | true
    }

  export interface DressModelDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['DressModel'], meta: { name: 'DressModel' } }
    /**
     * Find zero or one DressModel that matches the filter.
     * @param {DressModelFindUniqueArgs} args - Arguments to find a DressModel
     * @example
     * // Get one DressModel
     * const dressModel = await prisma.dressModel.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends DressModelFindUniqueArgs>(args: SelectSubset<T, DressModelFindUniqueArgs<ExtArgs>>): Prisma__DressModelClient<$Result.GetResult<Prisma.$DressModelPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one DressModel that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {DressModelFindUniqueOrThrowArgs} args - Arguments to find a DressModel
     * @example
     * // Get one DressModel
     * const dressModel = await prisma.dressModel.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends DressModelFindUniqueOrThrowArgs>(args: SelectSubset<T, DressModelFindUniqueOrThrowArgs<ExtArgs>>): Prisma__DressModelClient<$Result.GetResult<Prisma.$DressModelPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first DressModel that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DressModelFindFirstArgs} args - Arguments to find a DressModel
     * @example
     * // Get one DressModel
     * const dressModel = await prisma.dressModel.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends DressModelFindFirstArgs>(args?: SelectSubset<T, DressModelFindFirstArgs<ExtArgs>>): Prisma__DressModelClient<$Result.GetResult<Prisma.$DressModelPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first DressModel that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DressModelFindFirstOrThrowArgs} args - Arguments to find a DressModel
     * @example
     * // Get one DressModel
     * const dressModel = await prisma.dressModel.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends DressModelFindFirstOrThrowArgs>(args?: SelectSubset<T, DressModelFindFirstOrThrowArgs<ExtArgs>>): Prisma__DressModelClient<$Result.GetResult<Prisma.$DressModelPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more DressModels that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DressModelFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all DressModels
     * const dressModels = await prisma.dressModel.findMany()
     * 
     * // Get first 10 DressModels
     * const dressModels = await prisma.dressModel.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const dressModelWithIdOnly = await prisma.dressModel.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends DressModelFindManyArgs>(args?: SelectSubset<T, DressModelFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$DressModelPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a DressModel.
     * @param {DressModelCreateArgs} args - Arguments to create a DressModel.
     * @example
     * // Create one DressModel
     * const DressModel = await prisma.dressModel.create({
     *   data: {
     *     // ... data to create a DressModel
     *   }
     * })
     * 
     */
    create<T extends DressModelCreateArgs>(args: SelectSubset<T, DressModelCreateArgs<ExtArgs>>): Prisma__DressModelClient<$Result.GetResult<Prisma.$DressModelPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many DressModels.
     * @param {DressModelCreateManyArgs} args - Arguments to create many DressModels.
     * @example
     * // Create many DressModels
     * const dressModel = await prisma.dressModel.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends DressModelCreateManyArgs>(args?: SelectSubset<T, DressModelCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many DressModels and returns the data saved in the database.
     * @param {DressModelCreateManyAndReturnArgs} args - Arguments to create many DressModels.
     * @example
     * // Create many DressModels
     * const dressModel = await prisma.dressModel.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many DressModels and only return the `id`
     * const dressModelWithIdOnly = await prisma.dressModel.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends DressModelCreateManyAndReturnArgs>(args?: SelectSubset<T, DressModelCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$DressModelPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a DressModel.
     * @param {DressModelDeleteArgs} args - Arguments to delete one DressModel.
     * @example
     * // Delete one DressModel
     * const DressModel = await prisma.dressModel.delete({
     *   where: {
     *     // ... filter to delete one DressModel
     *   }
     * })
     * 
     */
    delete<T extends DressModelDeleteArgs>(args: SelectSubset<T, DressModelDeleteArgs<ExtArgs>>): Prisma__DressModelClient<$Result.GetResult<Prisma.$DressModelPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one DressModel.
     * @param {DressModelUpdateArgs} args - Arguments to update one DressModel.
     * @example
     * // Update one DressModel
     * const dressModel = await prisma.dressModel.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends DressModelUpdateArgs>(args: SelectSubset<T, DressModelUpdateArgs<ExtArgs>>): Prisma__DressModelClient<$Result.GetResult<Prisma.$DressModelPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more DressModels.
     * @param {DressModelDeleteManyArgs} args - Arguments to filter DressModels to delete.
     * @example
     * // Delete a few DressModels
     * const { count } = await prisma.dressModel.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends DressModelDeleteManyArgs>(args?: SelectSubset<T, DressModelDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more DressModels.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DressModelUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many DressModels
     * const dressModel = await prisma.dressModel.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends DressModelUpdateManyArgs>(args: SelectSubset<T, DressModelUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one DressModel.
     * @param {DressModelUpsertArgs} args - Arguments to update or create a DressModel.
     * @example
     * // Update or create a DressModel
     * const dressModel = await prisma.dressModel.upsert({
     *   create: {
     *     // ... data to create a DressModel
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the DressModel we want to update
     *   }
     * })
     */
    upsert<T extends DressModelUpsertArgs>(args: SelectSubset<T, DressModelUpsertArgs<ExtArgs>>): Prisma__DressModelClient<$Result.GetResult<Prisma.$DressModelPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of DressModels.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DressModelCountArgs} args - Arguments to filter DressModels to count.
     * @example
     * // Count the number of DressModels
     * const count = await prisma.dressModel.count({
     *   where: {
     *     // ... the filter for the DressModels we want to count
     *   }
     * })
    **/
    count<T extends DressModelCountArgs>(
      args?: Subset<T, DressModelCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], DressModelCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a DressModel.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DressModelAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends DressModelAggregateArgs>(args: Subset<T, DressModelAggregateArgs>): Prisma.PrismaPromise<GetDressModelAggregateType<T>>

    /**
     * Group by DressModel.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DressModelGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends DressModelGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: DressModelGroupByArgs['orderBy'] }
        : { orderBy?: DressModelGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, DressModelGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetDressModelGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the DressModel model
   */
  readonly fields: DressModelFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for DressModel.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__DressModelClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    items<T extends DressModel$itemsArgs<ExtArgs> = {}>(args?: Subset<T, DressModel$itemsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$DressItemPayload<ExtArgs>, T, "findMany"> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the DressModel model
   */ 
  interface DressModelFieldRefs {
    readonly id: FieldRef<"DressModel", 'Int'>
    readonly name: FieldRef<"DressModel", 'String'>
    readonly barcodePrefix: FieldRef<"DressModel", 'Int'>
    readonly priceCategory: FieldRef<"DressModel", 'String'>
    readonly notes: FieldRef<"DressModel", 'String'>
    readonly inInspection: FieldRef<"DressModel", 'Boolean'>
    readonly imageUrl: FieldRef<"DressModel", 'String'>
    readonly entryDateToRepo: FieldRef<"DressModel", 'DateTime'>
    readonly exitDateFromRepo: FieldRef<"DressModel", 'DateTime'>
    readonly isDeleted: FieldRef<"DressModel", 'Boolean'>
    readonly deletedAt: FieldRef<"DressModel", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * DressModel findUnique
   */
  export type DressModelFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DressModel
     */
    select?: DressModelSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DressModelInclude<ExtArgs> | null
    /**
     * Filter, which DressModel to fetch.
     */
    where: DressModelWhereUniqueInput
  }

  /**
   * DressModel findUniqueOrThrow
   */
  export type DressModelFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DressModel
     */
    select?: DressModelSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DressModelInclude<ExtArgs> | null
    /**
     * Filter, which DressModel to fetch.
     */
    where: DressModelWhereUniqueInput
  }

  /**
   * DressModel findFirst
   */
  export type DressModelFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DressModel
     */
    select?: DressModelSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DressModelInclude<ExtArgs> | null
    /**
     * Filter, which DressModel to fetch.
     */
    where?: DressModelWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of DressModels to fetch.
     */
    orderBy?: DressModelOrderByWithRelationInput | DressModelOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for DressModels.
     */
    cursor?: DressModelWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` DressModels from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` DressModels.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of DressModels.
     */
    distinct?: DressModelScalarFieldEnum | DressModelScalarFieldEnum[]
  }

  /**
   * DressModel findFirstOrThrow
   */
  export type DressModelFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DressModel
     */
    select?: DressModelSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DressModelInclude<ExtArgs> | null
    /**
     * Filter, which DressModel to fetch.
     */
    where?: DressModelWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of DressModels to fetch.
     */
    orderBy?: DressModelOrderByWithRelationInput | DressModelOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for DressModels.
     */
    cursor?: DressModelWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` DressModels from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` DressModels.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of DressModels.
     */
    distinct?: DressModelScalarFieldEnum | DressModelScalarFieldEnum[]
  }

  /**
   * DressModel findMany
   */
  export type DressModelFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DressModel
     */
    select?: DressModelSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DressModelInclude<ExtArgs> | null
    /**
     * Filter, which DressModels to fetch.
     */
    where?: DressModelWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of DressModels to fetch.
     */
    orderBy?: DressModelOrderByWithRelationInput | DressModelOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing DressModels.
     */
    cursor?: DressModelWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` DressModels from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` DressModels.
     */
    skip?: number
    distinct?: DressModelScalarFieldEnum | DressModelScalarFieldEnum[]
  }

  /**
   * DressModel create
   */
  export type DressModelCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DressModel
     */
    select?: DressModelSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DressModelInclude<ExtArgs> | null
    /**
     * The data needed to create a DressModel.
     */
    data?: XOR<DressModelCreateInput, DressModelUncheckedCreateInput>
  }

  /**
   * DressModel createMany
   */
  export type DressModelCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many DressModels.
     */
    data: DressModelCreateManyInput | DressModelCreateManyInput[]
  }

  /**
   * DressModel createManyAndReturn
   */
  export type DressModelCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DressModel
     */
    select?: DressModelSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many DressModels.
     */
    data: DressModelCreateManyInput | DressModelCreateManyInput[]
  }

  /**
   * DressModel update
   */
  export type DressModelUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DressModel
     */
    select?: DressModelSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DressModelInclude<ExtArgs> | null
    /**
     * The data needed to update a DressModel.
     */
    data: XOR<DressModelUpdateInput, DressModelUncheckedUpdateInput>
    /**
     * Choose, which DressModel to update.
     */
    where: DressModelWhereUniqueInput
  }

  /**
   * DressModel updateMany
   */
  export type DressModelUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update DressModels.
     */
    data: XOR<DressModelUpdateManyMutationInput, DressModelUncheckedUpdateManyInput>
    /**
     * Filter which DressModels to update
     */
    where?: DressModelWhereInput
  }

  /**
   * DressModel upsert
   */
  export type DressModelUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DressModel
     */
    select?: DressModelSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DressModelInclude<ExtArgs> | null
    /**
     * The filter to search for the DressModel to update in case it exists.
     */
    where: DressModelWhereUniqueInput
    /**
     * In case the DressModel found by the `where` argument doesn't exist, create a new DressModel with this data.
     */
    create: XOR<DressModelCreateInput, DressModelUncheckedCreateInput>
    /**
     * In case the DressModel was found with the provided `where` argument, update it with this data.
     */
    update: XOR<DressModelUpdateInput, DressModelUncheckedUpdateInput>
  }

  /**
   * DressModel delete
   */
  export type DressModelDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DressModel
     */
    select?: DressModelSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DressModelInclude<ExtArgs> | null
    /**
     * Filter which DressModel to delete.
     */
    where: DressModelWhereUniqueInput
  }

  /**
   * DressModel deleteMany
   */
  export type DressModelDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which DressModels to delete
     */
    where?: DressModelWhereInput
  }

  /**
   * DressModel.items
   */
  export type DressModel$itemsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DressItem
     */
    select?: DressItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DressItemInclude<ExtArgs> | null
    where?: DressItemWhereInput
    orderBy?: DressItemOrderByWithRelationInput | DressItemOrderByWithRelationInput[]
    cursor?: DressItemWhereUniqueInput
    take?: number
    skip?: number
    distinct?: DressItemScalarFieldEnum | DressItemScalarFieldEnum[]
  }

  /**
   * DressModel without action
   */
  export type DressModelDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DressModel
     */
    select?: DressModelSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DressModelInclude<ExtArgs> | null
  }


  /**
   * Model DressItem
   */

  export type AggregateDressItem = {
    _count: DressItemCountAggregateOutputType | null
    _avg: DressItemAvgAggregateOutputType | null
    _sum: DressItemSumAggregateOutputType | null
    _min: DressItemMinAggregateOutputType | null
    _max: DressItemMaxAggregateOutputType | null
  }

  export type DressItemAvgAggregateOutputType = {
    id: number | null
    barcodePrefix: number | null
    dressModelId: number | null
    serialNumber: number | null
    locationNum: number | null
    quantity: number | null
  }

  export type DressItemSumAggregateOutputType = {
    id: number | null
    barcodePrefix: number | null
    dressModelId: number | null
    serialNumber: number | null
    locationNum: number | null
    quantity: number | null
  }

  export type DressItemMinAggregateOutputType = {
    id: number | null
    barcodePrefix: number | null
    dressModelId: number | null
    dressName: string | null
    sizeText: string | null
    serialNumber: number | null
    dressBarcode: string | null
    location: string | null
    locationNum: number | null
    quantity: number | null
    inRepair: boolean | null
    notInUse: boolean | null
    notInUseSince: Date | null
    entryDateToRepo: Date | null
    isDeleted: boolean | null
    deletedAt: Date | null
  }

  export type DressItemMaxAggregateOutputType = {
    id: number | null
    barcodePrefix: number | null
    dressModelId: number | null
    dressName: string | null
    sizeText: string | null
    serialNumber: number | null
    dressBarcode: string | null
    location: string | null
    locationNum: number | null
    quantity: number | null
    inRepair: boolean | null
    notInUse: boolean | null
    notInUseSince: Date | null
    entryDateToRepo: Date | null
    isDeleted: boolean | null
    deletedAt: Date | null
  }

  export type DressItemCountAggregateOutputType = {
    id: number
    barcodePrefix: number
    dressModelId: number
    dressName: number
    sizeText: number
    serialNumber: number
    dressBarcode: number
    location: number
    locationNum: number
    quantity: number
    inRepair: number
    notInUse: number
    notInUseSince: number
    entryDateToRepo: number
    isDeleted: number
    deletedAt: number
    _all: number
  }


  export type DressItemAvgAggregateInputType = {
    id?: true
    barcodePrefix?: true
    dressModelId?: true
    serialNumber?: true
    locationNum?: true
    quantity?: true
  }

  export type DressItemSumAggregateInputType = {
    id?: true
    barcodePrefix?: true
    dressModelId?: true
    serialNumber?: true
    locationNum?: true
    quantity?: true
  }

  export type DressItemMinAggregateInputType = {
    id?: true
    barcodePrefix?: true
    dressModelId?: true
    dressName?: true
    sizeText?: true
    serialNumber?: true
    dressBarcode?: true
    location?: true
    locationNum?: true
    quantity?: true
    inRepair?: true
    notInUse?: true
    notInUseSince?: true
    entryDateToRepo?: true
    isDeleted?: true
    deletedAt?: true
  }

  export type DressItemMaxAggregateInputType = {
    id?: true
    barcodePrefix?: true
    dressModelId?: true
    dressName?: true
    sizeText?: true
    serialNumber?: true
    dressBarcode?: true
    location?: true
    locationNum?: true
    quantity?: true
    inRepair?: true
    notInUse?: true
    notInUseSince?: true
    entryDateToRepo?: true
    isDeleted?: true
    deletedAt?: true
  }

  export type DressItemCountAggregateInputType = {
    id?: true
    barcodePrefix?: true
    dressModelId?: true
    dressName?: true
    sizeText?: true
    serialNumber?: true
    dressBarcode?: true
    location?: true
    locationNum?: true
    quantity?: true
    inRepair?: true
    notInUse?: true
    notInUseSince?: true
    entryDateToRepo?: true
    isDeleted?: true
    deletedAt?: true
    _all?: true
  }

  export type DressItemAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which DressItem to aggregate.
     */
    where?: DressItemWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of DressItems to fetch.
     */
    orderBy?: DressItemOrderByWithRelationInput | DressItemOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: DressItemWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` DressItems from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` DressItems.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned DressItems
    **/
    _count?: true | DressItemCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: DressItemAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: DressItemSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: DressItemMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: DressItemMaxAggregateInputType
  }

  export type GetDressItemAggregateType<T extends DressItemAggregateArgs> = {
        [P in keyof T & keyof AggregateDressItem]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateDressItem[P]>
      : GetScalarType<T[P], AggregateDressItem[P]>
  }




  export type DressItemGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: DressItemWhereInput
    orderBy?: DressItemOrderByWithAggregationInput | DressItemOrderByWithAggregationInput[]
    by: DressItemScalarFieldEnum[] | DressItemScalarFieldEnum
    having?: DressItemScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: DressItemCountAggregateInputType | true
    _avg?: DressItemAvgAggregateInputType
    _sum?: DressItemSumAggregateInputType
    _min?: DressItemMinAggregateInputType
    _max?: DressItemMaxAggregateInputType
  }

  export type DressItemGroupByOutputType = {
    id: number
    barcodePrefix: number | null
    dressModelId: number | null
    dressName: string | null
    sizeText: string | null
    serialNumber: number | null
    dressBarcode: string | null
    location: string | null
    locationNum: number | null
    quantity: number | null
    inRepair: boolean
    notInUse: boolean
    notInUseSince: Date | null
    entryDateToRepo: Date | null
    isDeleted: boolean
    deletedAt: Date | null
    _count: DressItemCountAggregateOutputType | null
    _avg: DressItemAvgAggregateOutputType | null
    _sum: DressItemSumAggregateOutputType | null
    _min: DressItemMinAggregateOutputType | null
    _max: DressItemMaxAggregateOutputType | null
  }

  type GetDressItemGroupByPayload<T extends DressItemGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<DressItemGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof DressItemGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], DressItemGroupByOutputType[P]>
            : GetScalarType<T[P], DressItemGroupByOutputType[P]>
        }
      >
    >


  export type DressItemSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    barcodePrefix?: boolean
    dressModelId?: boolean
    dressName?: boolean
    sizeText?: boolean
    serialNumber?: boolean
    dressBarcode?: boolean
    location?: boolean
    locationNum?: boolean
    quantity?: boolean
    inRepair?: boolean
    notInUse?: boolean
    notInUseSince?: boolean
    entryDateToRepo?: boolean
    isDeleted?: boolean
    deletedAt?: boolean
    dress?: boolean | DressItem$dressArgs<ExtArgs>
    orderItems?: boolean | DressItem$orderItemsArgs<ExtArgs>
    _count?: boolean | DressItemCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["dressItem"]>

  export type DressItemSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    barcodePrefix?: boolean
    dressModelId?: boolean
    dressName?: boolean
    sizeText?: boolean
    serialNumber?: boolean
    dressBarcode?: boolean
    location?: boolean
    locationNum?: boolean
    quantity?: boolean
    inRepair?: boolean
    notInUse?: boolean
    notInUseSince?: boolean
    entryDateToRepo?: boolean
    isDeleted?: boolean
    deletedAt?: boolean
    dress?: boolean | DressItem$dressArgs<ExtArgs>
  }, ExtArgs["result"]["dressItem"]>

  export type DressItemSelectScalar = {
    id?: boolean
    barcodePrefix?: boolean
    dressModelId?: boolean
    dressName?: boolean
    sizeText?: boolean
    serialNumber?: boolean
    dressBarcode?: boolean
    location?: boolean
    locationNum?: boolean
    quantity?: boolean
    inRepair?: boolean
    notInUse?: boolean
    notInUseSince?: boolean
    entryDateToRepo?: boolean
    isDeleted?: boolean
    deletedAt?: boolean
  }

  export type DressItemInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    dress?: boolean | DressItem$dressArgs<ExtArgs>
    orderItems?: boolean | DressItem$orderItemsArgs<ExtArgs>
    _count?: boolean | DressItemCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type DressItemIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    dress?: boolean | DressItem$dressArgs<ExtArgs>
  }

  export type $DressItemPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "DressItem"
    objects: {
      dress: Prisma.$DressModelPayload<ExtArgs> | null
      orderItems: Prisma.$OrderItemPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: number
      barcodePrefix: number | null
      dressModelId: number | null
      dressName: string | null
      sizeText: string | null
      serialNumber: number | null
      dressBarcode: string | null
      location: string | null
      locationNum: number | null
      quantity: number | null
      inRepair: boolean
      notInUse: boolean
      notInUseSince: Date | null
      entryDateToRepo: Date | null
      isDeleted: boolean
      deletedAt: Date | null
    }, ExtArgs["result"]["dressItem"]>
    composites: {}
  }

  type DressItemGetPayload<S extends boolean | null | undefined | DressItemDefaultArgs> = $Result.GetResult<Prisma.$DressItemPayload, S>

  type DressItemCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<DressItemFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: DressItemCountAggregateInputType | true
    }

  export interface DressItemDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['DressItem'], meta: { name: 'DressItem' } }
    /**
     * Find zero or one DressItem that matches the filter.
     * @param {DressItemFindUniqueArgs} args - Arguments to find a DressItem
     * @example
     * // Get one DressItem
     * const dressItem = await prisma.dressItem.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends DressItemFindUniqueArgs>(args: SelectSubset<T, DressItemFindUniqueArgs<ExtArgs>>): Prisma__DressItemClient<$Result.GetResult<Prisma.$DressItemPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one DressItem that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {DressItemFindUniqueOrThrowArgs} args - Arguments to find a DressItem
     * @example
     * // Get one DressItem
     * const dressItem = await prisma.dressItem.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends DressItemFindUniqueOrThrowArgs>(args: SelectSubset<T, DressItemFindUniqueOrThrowArgs<ExtArgs>>): Prisma__DressItemClient<$Result.GetResult<Prisma.$DressItemPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first DressItem that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DressItemFindFirstArgs} args - Arguments to find a DressItem
     * @example
     * // Get one DressItem
     * const dressItem = await prisma.dressItem.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends DressItemFindFirstArgs>(args?: SelectSubset<T, DressItemFindFirstArgs<ExtArgs>>): Prisma__DressItemClient<$Result.GetResult<Prisma.$DressItemPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first DressItem that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DressItemFindFirstOrThrowArgs} args - Arguments to find a DressItem
     * @example
     * // Get one DressItem
     * const dressItem = await prisma.dressItem.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends DressItemFindFirstOrThrowArgs>(args?: SelectSubset<T, DressItemFindFirstOrThrowArgs<ExtArgs>>): Prisma__DressItemClient<$Result.GetResult<Prisma.$DressItemPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more DressItems that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DressItemFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all DressItems
     * const dressItems = await prisma.dressItem.findMany()
     * 
     * // Get first 10 DressItems
     * const dressItems = await prisma.dressItem.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const dressItemWithIdOnly = await prisma.dressItem.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends DressItemFindManyArgs>(args?: SelectSubset<T, DressItemFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$DressItemPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a DressItem.
     * @param {DressItemCreateArgs} args - Arguments to create a DressItem.
     * @example
     * // Create one DressItem
     * const DressItem = await prisma.dressItem.create({
     *   data: {
     *     // ... data to create a DressItem
     *   }
     * })
     * 
     */
    create<T extends DressItemCreateArgs>(args: SelectSubset<T, DressItemCreateArgs<ExtArgs>>): Prisma__DressItemClient<$Result.GetResult<Prisma.$DressItemPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many DressItems.
     * @param {DressItemCreateManyArgs} args - Arguments to create many DressItems.
     * @example
     * // Create many DressItems
     * const dressItem = await prisma.dressItem.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends DressItemCreateManyArgs>(args?: SelectSubset<T, DressItemCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many DressItems and returns the data saved in the database.
     * @param {DressItemCreateManyAndReturnArgs} args - Arguments to create many DressItems.
     * @example
     * // Create many DressItems
     * const dressItem = await prisma.dressItem.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many DressItems and only return the `id`
     * const dressItemWithIdOnly = await prisma.dressItem.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends DressItemCreateManyAndReturnArgs>(args?: SelectSubset<T, DressItemCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$DressItemPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a DressItem.
     * @param {DressItemDeleteArgs} args - Arguments to delete one DressItem.
     * @example
     * // Delete one DressItem
     * const DressItem = await prisma.dressItem.delete({
     *   where: {
     *     // ... filter to delete one DressItem
     *   }
     * })
     * 
     */
    delete<T extends DressItemDeleteArgs>(args: SelectSubset<T, DressItemDeleteArgs<ExtArgs>>): Prisma__DressItemClient<$Result.GetResult<Prisma.$DressItemPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one DressItem.
     * @param {DressItemUpdateArgs} args - Arguments to update one DressItem.
     * @example
     * // Update one DressItem
     * const dressItem = await prisma.dressItem.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends DressItemUpdateArgs>(args: SelectSubset<T, DressItemUpdateArgs<ExtArgs>>): Prisma__DressItemClient<$Result.GetResult<Prisma.$DressItemPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more DressItems.
     * @param {DressItemDeleteManyArgs} args - Arguments to filter DressItems to delete.
     * @example
     * // Delete a few DressItems
     * const { count } = await prisma.dressItem.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends DressItemDeleteManyArgs>(args?: SelectSubset<T, DressItemDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more DressItems.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DressItemUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many DressItems
     * const dressItem = await prisma.dressItem.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends DressItemUpdateManyArgs>(args: SelectSubset<T, DressItemUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one DressItem.
     * @param {DressItemUpsertArgs} args - Arguments to update or create a DressItem.
     * @example
     * // Update or create a DressItem
     * const dressItem = await prisma.dressItem.upsert({
     *   create: {
     *     // ... data to create a DressItem
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the DressItem we want to update
     *   }
     * })
     */
    upsert<T extends DressItemUpsertArgs>(args: SelectSubset<T, DressItemUpsertArgs<ExtArgs>>): Prisma__DressItemClient<$Result.GetResult<Prisma.$DressItemPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of DressItems.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DressItemCountArgs} args - Arguments to filter DressItems to count.
     * @example
     * // Count the number of DressItems
     * const count = await prisma.dressItem.count({
     *   where: {
     *     // ... the filter for the DressItems we want to count
     *   }
     * })
    **/
    count<T extends DressItemCountArgs>(
      args?: Subset<T, DressItemCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], DressItemCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a DressItem.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DressItemAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends DressItemAggregateArgs>(args: Subset<T, DressItemAggregateArgs>): Prisma.PrismaPromise<GetDressItemAggregateType<T>>

    /**
     * Group by DressItem.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DressItemGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends DressItemGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: DressItemGroupByArgs['orderBy'] }
        : { orderBy?: DressItemGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, DressItemGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetDressItemGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the DressItem model
   */
  readonly fields: DressItemFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for DressItem.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__DressItemClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    dress<T extends DressItem$dressArgs<ExtArgs> = {}>(args?: Subset<T, DressItem$dressArgs<ExtArgs>>): Prisma__DressModelClient<$Result.GetResult<Prisma.$DressModelPayload<ExtArgs>, T, "findUniqueOrThrow"> | null, null, ExtArgs>
    orderItems<T extends DressItem$orderItemsArgs<ExtArgs> = {}>(args?: Subset<T, DressItem$orderItemsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$OrderItemPayload<ExtArgs>, T, "findMany"> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the DressItem model
   */ 
  interface DressItemFieldRefs {
    readonly id: FieldRef<"DressItem", 'Int'>
    readonly barcodePrefix: FieldRef<"DressItem", 'Int'>
    readonly dressModelId: FieldRef<"DressItem", 'Int'>
    readonly dressName: FieldRef<"DressItem", 'String'>
    readonly sizeText: FieldRef<"DressItem", 'String'>
    readonly serialNumber: FieldRef<"DressItem", 'Int'>
    readonly dressBarcode: FieldRef<"DressItem", 'String'>
    readonly location: FieldRef<"DressItem", 'String'>
    readonly locationNum: FieldRef<"DressItem", 'Int'>
    readonly quantity: FieldRef<"DressItem", 'Int'>
    readonly inRepair: FieldRef<"DressItem", 'Boolean'>
    readonly notInUse: FieldRef<"DressItem", 'Boolean'>
    readonly notInUseSince: FieldRef<"DressItem", 'DateTime'>
    readonly entryDateToRepo: FieldRef<"DressItem", 'DateTime'>
    readonly isDeleted: FieldRef<"DressItem", 'Boolean'>
    readonly deletedAt: FieldRef<"DressItem", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * DressItem findUnique
   */
  export type DressItemFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DressItem
     */
    select?: DressItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DressItemInclude<ExtArgs> | null
    /**
     * Filter, which DressItem to fetch.
     */
    where: DressItemWhereUniqueInput
  }

  /**
   * DressItem findUniqueOrThrow
   */
  export type DressItemFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DressItem
     */
    select?: DressItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DressItemInclude<ExtArgs> | null
    /**
     * Filter, which DressItem to fetch.
     */
    where: DressItemWhereUniqueInput
  }

  /**
   * DressItem findFirst
   */
  export type DressItemFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DressItem
     */
    select?: DressItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DressItemInclude<ExtArgs> | null
    /**
     * Filter, which DressItem to fetch.
     */
    where?: DressItemWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of DressItems to fetch.
     */
    orderBy?: DressItemOrderByWithRelationInput | DressItemOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for DressItems.
     */
    cursor?: DressItemWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` DressItems from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` DressItems.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of DressItems.
     */
    distinct?: DressItemScalarFieldEnum | DressItemScalarFieldEnum[]
  }

  /**
   * DressItem findFirstOrThrow
   */
  export type DressItemFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DressItem
     */
    select?: DressItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DressItemInclude<ExtArgs> | null
    /**
     * Filter, which DressItem to fetch.
     */
    where?: DressItemWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of DressItems to fetch.
     */
    orderBy?: DressItemOrderByWithRelationInput | DressItemOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for DressItems.
     */
    cursor?: DressItemWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` DressItems from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` DressItems.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of DressItems.
     */
    distinct?: DressItemScalarFieldEnum | DressItemScalarFieldEnum[]
  }

  /**
   * DressItem findMany
   */
  export type DressItemFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DressItem
     */
    select?: DressItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DressItemInclude<ExtArgs> | null
    /**
     * Filter, which DressItems to fetch.
     */
    where?: DressItemWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of DressItems to fetch.
     */
    orderBy?: DressItemOrderByWithRelationInput | DressItemOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing DressItems.
     */
    cursor?: DressItemWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` DressItems from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` DressItems.
     */
    skip?: number
    distinct?: DressItemScalarFieldEnum | DressItemScalarFieldEnum[]
  }

  /**
   * DressItem create
   */
  export type DressItemCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DressItem
     */
    select?: DressItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DressItemInclude<ExtArgs> | null
    /**
     * The data needed to create a DressItem.
     */
    data?: XOR<DressItemCreateInput, DressItemUncheckedCreateInput>
  }

  /**
   * DressItem createMany
   */
  export type DressItemCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many DressItems.
     */
    data: DressItemCreateManyInput | DressItemCreateManyInput[]
  }

  /**
   * DressItem createManyAndReturn
   */
  export type DressItemCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DressItem
     */
    select?: DressItemSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many DressItems.
     */
    data: DressItemCreateManyInput | DressItemCreateManyInput[]
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DressItemIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * DressItem update
   */
  export type DressItemUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DressItem
     */
    select?: DressItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DressItemInclude<ExtArgs> | null
    /**
     * The data needed to update a DressItem.
     */
    data: XOR<DressItemUpdateInput, DressItemUncheckedUpdateInput>
    /**
     * Choose, which DressItem to update.
     */
    where: DressItemWhereUniqueInput
  }

  /**
   * DressItem updateMany
   */
  export type DressItemUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update DressItems.
     */
    data: XOR<DressItemUpdateManyMutationInput, DressItemUncheckedUpdateManyInput>
    /**
     * Filter which DressItems to update
     */
    where?: DressItemWhereInput
  }

  /**
   * DressItem upsert
   */
  export type DressItemUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DressItem
     */
    select?: DressItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DressItemInclude<ExtArgs> | null
    /**
     * The filter to search for the DressItem to update in case it exists.
     */
    where: DressItemWhereUniqueInput
    /**
     * In case the DressItem found by the `where` argument doesn't exist, create a new DressItem with this data.
     */
    create: XOR<DressItemCreateInput, DressItemUncheckedCreateInput>
    /**
     * In case the DressItem was found with the provided `where` argument, update it with this data.
     */
    update: XOR<DressItemUpdateInput, DressItemUncheckedUpdateInput>
  }

  /**
   * DressItem delete
   */
  export type DressItemDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DressItem
     */
    select?: DressItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DressItemInclude<ExtArgs> | null
    /**
     * Filter which DressItem to delete.
     */
    where: DressItemWhereUniqueInput
  }

  /**
   * DressItem deleteMany
   */
  export type DressItemDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which DressItems to delete
     */
    where?: DressItemWhereInput
  }

  /**
   * DressItem.dress
   */
  export type DressItem$dressArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DressModel
     */
    select?: DressModelSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DressModelInclude<ExtArgs> | null
    where?: DressModelWhereInput
  }

  /**
   * DressItem.orderItems
   */
  export type DressItem$orderItemsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OrderItem
     */
    select?: OrderItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrderItemInclude<ExtArgs> | null
    where?: OrderItemWhereInput
    orderBy?: OrderItemOrderByWithRelationInput | OrderItemOrderByWithRelationInput[]
    cursor?: OrderItemWhereUniqueInput
    take?: number
    skip?: number
    distinct?: OrderItemScalarFieldEnum | OrderItemScalarFieldEnum[]
  }

  /**
   * DressItem without action
   */
  export type DressItemDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DressItem
     */
    select?: DressItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DressItemInclude<ExtArgs> | null
  }


  /**
   * Model Order
   */

  export type AggregateOrder = {
    _count: OrderCountAggregateOutputType | null
    _avg: OrderAvgAggregateOutputType | null
    _sum: OrderSumAggregateOutputType | null
    _min: OrderMinAggregateOutputType | null
    _max: OrderMaxAggregateOutputType | null
  }

  export type OrderAvgAggregateOutputType = {
    id: number | null
    orderId: number | null
    customerId: number | null
    totalAmount: number | null
  }

  export type OrderSumAggregateOutputType = {
    id: number | null
    orderId: number | null
    customerId: number | null
    totalAmount: number | null
  }

  export type OrderMinAggregateOutputType = {
    id: number | null
    orderId: number | null
    customerId: number | null
    totalAmount: number | null
    paymentDate: Date | null
    paymentMethod: string | null
    status: string | null
    notes: string | null
    isPaid: boolean | null
    isDeleted: boolean | null
    orderNotes: string | null
    eventDate: Date | null
    eventDateHebrew: string | null
    returnDate: Date | null
    isWeekdayEvent: boolean | null
    orderDate: Date | null
    isAbroad: boolean | null
    fromDate: Date | null
    toDate: Date | null
  }

  export type OrderMaxAggregateOutputType = {
    id: number | null
    orderId: number | null
    customerId: number | null
    totalAmount: number | null
    paymentDate: Date | null
    paymentMethod: string | null
    status: string | null
    notes: string | null
    isPaid: boolean | null
    isDeleted: boolean | null
    orderNotes: string | null
    eventDate: Date | null
    eventDateHebrew: string | null
    returnDate: Date | null
    isWeekdayEvent: boolean | null
    orderDate: Date | null
    isAbroad: boolean | null
    fromDate: Date | null
    toDate: Date | null
  }

  export type OrderCountAggregateOutputType = {
    id: number
    orderId: number
    customerId: number
    totalAmount: number
    paymentDate: number
    paymentMethod: number
    status: number
    notes: number
    isPaid: number
    isDeleted: number
    orderNotes: number
    eventDate: number
    eventDateHebrew: number
    returnDate: number
    isWeekdayEvent: number
    orderDate: number
    isAbroad: number
    fromDate: number
    toDate: number
    _all: number
  }


  export type OrderAvgAggregateInputType = {
    id?: true
    orderId?: true
    customerId?: true
    totalAmount?: true
  }

  export type OrderSumAggregateInputType = {
    id?: true
    orderId?: true
    customerId?: true
    totalAmount?: true
  }

  export type OrderMinAggregateInputType = {
    id?: true
    orderId?: true
    customerId?: true
    totalAmount?: true
    paymentDate?: true
    paymentMethod?: true
    status?: true
    notes?: true
    isPaid?: true
    isDeleted?: true
    orderNotes?: true
    eventDate?: true
    eventDateHebrew?: true
    returnDate?: true
    isWeekdayEvent?: true
    orderDate?: true
    isAbroad?: true
    fromDate?: true
    toDate?: true
  }

  export type OrderMaxAggregateInputType = {
    id?: true
    orderId?: true
    customerId?: true
    totalAmount?: true
    paymentDate?: true
    paymentMethod?: true
    status?: true
    notes?: true
    isPaid?: true
    isDeleted?: true
    orderNotes?: true
    eventDate?: true
    eventDateHebrew?: true
    returnDate?: true
    isWeekdayEvent?: true
    orderDate?: true
    isAbroad?: true
    fromDate?: true
    toDate?: true
  }

  export type OrderCountAggregateInputType = {
    id?: true
    orderId?: true
    customerId?: true
    totalAmount?: true
    paymentDate?: true
    paymentMethod?: true
    status?: true
    notes?: true
    isPaid?: true
    isDeleted?: true
    orderNotes?: true
    eventDate?: true
    eventDateHebrew?: true
    returnDate?: true
    isWeekdayEvent?: true
    orderDate?: true
    isAbroad?: true
    fromDate?: true
    toDate?: true
    _all?: true
  }

  export type OrderAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Order to aggregate.
     */
    where?: OrderWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Orders to fetch.
     */
    orderBy?: OrderOrderByWithRelationInput | OrderOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: OrderWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Orders from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Orders.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Orders
    **/
    _count?: true | OrderCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: OrderAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: OrderSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: OrderMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: OrderMaxAggregateInputType
  }

  export type GetOrderAggregateType<T extends OrderAggregateArgs> = {
        [P in keyof T & keyof AggregateOrder]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateOrder[P]>
      : GetScalarType<T[P], AggregateOrder[P]>
  }




  export type OrderGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: OrderWhereInput
    orderBy?: OrderOrderByWithAggregationInput | OrderOrderByWithAggregationInput[]
    by: OrderScalarFieldEnum[] | OrderScalarFieldEnum
    having?: OrderScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: OrderCountAggregateInputType | true
    _avg?: OrderAvgAggregateInputType
    _sum?: OrderSumAggregateInputType
    _min?: OrderMinAggregateInputType
    _max?: OrderMaxAggregateInputType
  }

  export type OrderGroupByOutputType = {
    id: number
    orderId: number
    customerId: number | null
    totalAmount: number | null
    paymentDate: Date | null
    paymentMethod: string | null
    status: string | null
    notes: string | null
    isPaid: boolean
    isDeleted: boolean
    orderNotes: string | null
    eventDate: Date | null
    eventDateHebrew: string | null
    returnDate: Date | null
    isWeekdayEvent: boolean
    orderDate: Date | null
    isAbroad: boolean
    fromDate: Date | null
    toDate: Date | null
    _count: OrderCountAggregateOutputType | null
    _avg: OrderAvgAggregateOutputType | null
    _sum: OrderSumAggregateOutputType | null
    _min: OrderMinAggregateOutputType | null
    _max: OrderMaxAggregateOutputType | null
  }

  type GetOrderGroupByPayload<T extends OrderGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<OrderGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof OrderGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], OrderGroupByOutputType[P]>
            : GetScalarType<T[P], OrderGroupByOutputType[P]>
        }
      >
    >


  export type OrderSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    orderId?: boolean
    customerId?: boolean
    totalAmount?: boolean
    paymentDate?: boolean
    paymentMethod?: boolean
    status?: boolean
    notes?: boolean
    isPaid?: boolean
    isDeleted?: boolean
    orderNotes?: boolean
    eventDate?: boolean
    eventDateHebrew?: boolean
    returnDate?: boolean
    isWeekdayEvent?: boolean
    orderDate?: boolean
    isAbroad?: boolean
    fromDate?: boolean
    toDate?: boolean
    customer?: boolean | Order$customerArgs<ExtArgs>
    items?: boolean | Order$itemsArgs<ExtArgs>
    payments?: boolean | Order$paymentsArgs<ExtArgs>
    obligations?: boolean | Order$obligationsArgs<ExtArgs>
    _count?: boolean | OrderCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["order"]>

  export type OrderSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    orderId?: boolean
    customerId?: boolean
    totalAmount?: boolean
    paymentDate?: boolean
    paymentMethod?: boolean
    status?: boolean
    notes?: boolean
    isPaid?: boolean
    isDeleted?: boolean
    orderNotes?: boolean
    eventDate?: boolean
    eventDateHebrew?: boolean
    returnDate?: boolean
    isWeekdayEvent?: boolean
    orderDate?: boolean
    isAbroad?: boolean
    fromDate?: boolean
    toDate?: boolean
    customer?: boolean | Order$customerArgs<ExtArgs>
  }, ExtArgs["result"]["order"]>

  export type OrderSelectScalar = {
    id?: boolean
    orderId?: boolean
    customerId?: boolean
    totalAmount?: boolean
    paymentDate?: boolean
    paymentMethod?: boolean
    status?: boolean
    notes?: boolean
    isPaid?: boolean
    isDeleted?: boolean
    orderNotes?: boolean
    eventDate?: boolean
    eventDateHebrew?: boolean
    returnDate?: boolean
    isWeekdayEvent?: boolean
    orderDate?: boolean
    isAbroad?: boolean
    fromDate?: boolean
    toDate?: boolean
  }

  export type OrderInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    customer?: boolean | Order$customerArgs<ExtArgs>
    items?: boolean | Order$itemsArgs<ExtArgs>
    payments?: boolean | Order$paymentsArgs<ExtArgs>
    obligations?: boolean | Order$obligationsArgs<ExtArgs>
    _count?: boolean | OrderCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type OrderIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    customer?: boolean | Order$customerArgs<ExtArgs>
  }

  export type $OrderPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Order"
    objects: {
      customer: Prisma.$CustomerPayload<ExtArgs> | null
      items: Prisma.$OrderItemPayload<ExtArgs>[]
      payments: Prisma.$PaymentPayload<ExtArgs>[]
      obligations: Prisma.$PaymentObligationPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: number
      orderId: number
      customerId: number | null
      totalAmount: number | null
      paymentDate: Date | null
      paymentMethod: string | null
      status: string | null
      notes: string | null
      isPaid: boolean
      isDeleted: boolean
      orderNotes: string | null
      eventDate: Date | null
      eventDateHebrew: string | null
      returnDate: Date | null
      isWeekdayEvent: boolean
      orderDate: Date | null
      isAbroad: boolean
      fromDate: Date | null
      toDate: Date | null
    }, ExtArgs["result"]["order"]>
    composites: {}
  }

  type OrderGetPayload<S extends boolean | null | undefined | OrderDefaultArgs> = $Result.GetResult<Prisma.$OrderPayload, S>

  type OrderCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<OrderFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: OrderCountAggregateInputType | true
    }

  export interface OrderDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Order'], meta: { name: 'Order' } }
    /**
     * Find zero or one Order that matches the filter.
     * @param {OrderFindUniqueArgs} args - Arguments to find a Order
     * @example
     * // Get one Order
     * const order = await prisma.order.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends OrderFindUniqueArgs>(args: SelectSubset<T, OrderFindUniqueArgs<ExtArgs>>): Prisma__OrderClient<$Result.GetResult<Prisma.$OrderPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one Order that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {OrderFindUniqueOrThrowArgs} args - Arguments to find a Order
     * @example
     * // Get one Order
     * const order = await prisma.order.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends OrderFindUniqueOrThrowArgs>(args: SelectSubset<T, OrderFindUniqueOrThrowArgs<ExtArgs>>): Prisma__OrderClient<$Result.GetResult<Prisma.$OrderPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first Order that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrderFindFirstArgs} args - Arguments to find a Order
     * @example
     * // Get one Order
     * const order = await prisma.order.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends OrderFindFirstArgs>(args?: SelectSubset<T, OrderFindFirstArgs<ExtArgs>>): Prisma__OrderClient<$Result.GetResult<Prisma.$OrderPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first Order that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrderFindFirstOrThrowArgs} args - Arguments to find a Order
     * @example
     * // Get one Order
     * const order = await prisma.order.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends OrderFindFirstOrThrowArgs>(args?: SelectSubset<T, OrderFindFirstOrThrowArgs<ExtArgs>>): Prisma__OrderClient<$Result.GetResult<Prisma.$OrderPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more Orders that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrderFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Orders
     * const orders = await prisma.order.findMany()
     * 
     * // Get first 10 Orders
     * const orders = await prisma.order.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const orderWithIdOnly = await prisma.order.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends OrderFindManyArgs>(args?: SelectSubset<T, OrderFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$OrderPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a Order.
     * @param {OrderCreateArgs} args - Arguments to create a Order.
     * @example
     * // Create one Order
     * const Order = await prisma.order.create({
     *   data: {
     *     // ... data to create a Order
     *   }
     * })
     * 
     */
    create<T extends OrderCreateArgs>(args: SelectSubset<T, OrderCreateArgs<ExtArgs>>): Prisma__OrderClient<$Result.GetResult<Prisma.$OrderPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many Orders.
     * @param {OrderCreateManyArgs} args - Arguments to create many Orders.
     * @example
     * // Create many Orders
     * const order = await prisma.order.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends OrderCreateManyArgs>(args?: SelectSubset<T, OrderCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Orders and returns the data saved in the database.
     * @param {OrderCreateManyAndReturnArgs} args - Arguments to create many Orders.
     * @example
     * // Create many Orders
     * const order = await prisma.order.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Orders and only return the `id`
     * const orderWithIdOnly = await prisma.order.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends OrderCreateManyAndReturnArgs>(args?: SelectSubset<T, OrderCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$OrderPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a Order.
     * @param {OrderDeleteArgs} args - Arguments to delete one Order.
     * @example
     * // Delete one Order
     * const Order = await prisma.order.delete({
     *   where: {
     *     // ... filter to delete one Order
     *   }
     * })
     * 
     */
    delete<T extends OrderDeleteArgs>(args: SelectSubset<T, OrderDeleteArgs<ExtArgs>>): Prisma__OrderClient<$Result.GetResult<Prisma.$OrderPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one Order.
     * @param {OrderUpdateArgs} args - Arguments to update one Order.
     * @example
     * // Update one Order
     * const order = await prisma.order.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends OrderUpdateArgs>(args: SelectSubset<T, OrderUpdateArgs<ExtArgs>>): Prisma__OrderClient<$Result.GetResult<Prisma.$OrderPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more Orders.
     * @param {OrderDeleteManyArgs} args - Arguments to filter Orders to delete.
     * @example
     * // Delete a few Orders
     * const { count } = await prisma.order.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends OrderDeleteManyArgs>(args?: SelectSubset<T, OrderDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Orders.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrderUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Orders
     * const order = await prisma.order.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends OrderUpdateManyArgs>(args: SelectSubset<T, OrderUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one Order.
     * @param {OrderUpsertArgs} args - Arguments to update or create a Order.
     * @example
     * // Update or create a Order
     * const order = await prisma.order.upsert({
     *   create: {
     *     // ... data to create a Order
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Order we want to update
     *   }
     * })
     */
    upsert<T extends OrderUpsertArgs>(args: SelectSubset<T, OrderUpsertArgs<ExtArgs>>): Prisma__OrderClient<$Result.GetResult<Prisma.$OrderPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of Orders.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrderCountArgs} args - Arguments to filter Orders to count.
     * @example
     * // Count the number of Orders
     * const count = await prisma.order.count({
     *   where: {
     *     // ... the filter for the Orders we want to count
     *   }
     * })
    **/
    count<T extends OrderCountArgs>(
      args?: Subset<T, OrderCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], OrderCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Order.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrderAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends OrderAggregateArgs>(args: Subset<T, OrderAggregateArgs>): Prisma.PrismaPromise<GetOrderAggregateType<T>>

    /**
     * Group by Order.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrderGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends OrderGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: OrderGroupByArgs['orderBy'] }
        : { orderBy?: OrderGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, OrderGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetOrderGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Order model
   */
  readonly fields: OrderFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Order.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__OrderClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    customer<T extends Order$customerArgs<ExtArgs> = {}>(args?: Subset<T, Order$customerArgs<ExtArgs>>): Prisma__CustomerClient<$Result.GetResult<Prisma.$CustomerPayload<ExtArgs>, T, "findUniqueOrThrow"> | null, null, ExtArgs>
    items<T extends Order$itemsArgs<ExtArgs> = {}>(args?: Subset<T, Order$itemsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$OrderItemPayload<ExtArgs>, T, "findMany"> | Null>
    payments<T extends Order$paymentsArgs<ExtArgs> = {}>(args?: Subset<T, Order$paymentsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PaymentPayload<ExtArgs>, T, "findMany"> | Null>
    obligations<T extends Order$obligationsArgs<ExtArgs> = {}>(args?: Subset<T, Order$obligationsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PaymentObligationPayload<ExtArgs>, T, "findMany"> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Order model
   */ 
  interface OrderFieldRefs {
    readonly id: FieldRef<"Order", 'Int'>
    readonly orderId: FieldRef<"Order", 'Int'>
    readonly customerId: FieldRef<"Order", 'Int'>
    readonly totalAmount: FieldRef<"Order", 'Float'>
    readonly paymentDate: FieldRef<"Order", 'DateTime'>
    readonly paymentMethod: FieldRef<"Order", 'String'>
    readonly status: FieldRef<"Order", 'String'>
    readonly notes: FieldRef<"Order", 'String'>
    readonly isPaid: FieldRef<"Order", 'Boolean'>
    readonly isDeleted: FieldRef<"Order", 'Boolean'>
    readonly orderNotes: FieldRef<"Order", 'String'>
    readonly eventDate: FieldRef<"Order", 'DateTime'>
    readonly eventDateHebrew: FieldRef<"Order", 'String'>
    readonly returnDate: FieldRef<"Order", 'DateTime'>
    readonly isWeekdayEvent: FieldRef<"Order", 'Boolean'>
    readonly orderDate: FieldRef<"Order", 'DateTime'>
    readonly isAbroad: FieldRef<"Order", 'Boolean'>
    readonly fromDate: FieldRef<"Order", 'DateTime'>
    readonly toDate: FieldRef<"Order", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Order findUnique
   */
  export type OrderFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Order
     */
    select?: OrderSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrderInclude<ExtArgs> | null
    /**
     * Filter, which Order to fetch.
     */
    where: OrderWhereUniqueInput
  }

  /**
   * Order findUniqueOrThrow
   */
  export type OrderFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Order
     */
    select?: OrderSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrderInclude<ExtArgs> | null
    /**
     * Filter, which Order to fetch.
     */
    where: OrderWhereUniqueInput
  }

  /**
   * Order findFirst
   */
  export type OrderFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Order
     */
    select?: OrderSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrderInclude<ExtArgs> | null
    /**
     * Filter, which Order to fetch.
     */
    where?: OrderWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Orders to fetch.
     */
    orderBy?: OrderOrderByWithRelationInput | OrderOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Orders.
     */
    cursor?: OrderWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Orders from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Orders.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Orders.
     */
    distinct?: OrderScalarFieldEnum | OrderScalarFieldEnum[]
  }

  /**
   * Order findFirstOrThrow
   */
  export type OrderFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Order
     */
    select?: OrderSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrderInclude<ExtArgs> | null
    /**
     * Filter, which Order to fetch.
     */
    where?: OrderWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Orders to fetch.
     */
    orderBy?: OrderOrderByWithRelationInput | OrderOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Orders.
     */
    cursor?: OrderWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Orders from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Orders.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Orders.
     */
    distinct?: OrderScalarFieldEnum | OrderScalarFieldEnum[]
  }

  /**
   * Order findMany
   */
  export type OrderFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Order
     */
    select?: OrderSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrderInclude<ExtArgs> | null
    /**
     * Filter, which Orders to fetch.
     */
    where?: OrderWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Orders to fetch.
     */
    orderBy?: OrderOrderByWithRelationInput | OrderOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Orders.
     */
    cursor?: OrderWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Orders from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Orders.
     */
    skip?: number
    distinct?: OrderScalarFieldEnum | OrderScalarFieldEnum[]
  }

  /**
   * Order create
   */
  export type OrderCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Order
     */
    select?: OrderSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrderInclude<ExtArgs> | null
    /**
     * The data needed to create a Order.
     */
    data: XOR<OrderCreateInput, OrderUncheckedCreateInput>
  }

  /**
   * Order createMany
   */
  export type OrderCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Orders.
     */
    data: OrderCreateManyInput | OrderCreateManyInput[]
  }

  /**
   * Order createManyAndReturn
   */
  export type OrderCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Order
     */
    select?: OrderSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many Orders.
     */
    data: OrderCreateManyInput | OrderCreateManyInput[]
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrderIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * Order update
   */
  export type OrderUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Order
     */
    select?: OrderSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrderInclude<ExtArgs> | null
    /**
     * The data needed to update a Order.
     */
    data: XOR<OrderUpdateInput, OrderUncheckedUpdateInput>
    /**
     * Choose, which Order to update.
     */
    where: OrderWhereUniqueInput
  }

  /**
   * Order updateMany
   */
  export type OrderUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Orders.
     */
    data: XOR<OrderUpdateManyMutationInput, OrderUncheckedUpdateManyInput>
    /**
     * Filter which Orders to update
     */
    where?: OrderWhereInput
  }

  /**
   * Order upsert
   */
  export type OrderUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Order
     */
    select?: OrderSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrderInclude<ExtArgs> | null
    /**
     * The filter to search for the Order to update in case it exists.
     */
    where: OrderWhereUniqueInput
    /**
     * In case the Order found by the `where` argument doesn't exist, create a new Order with this data.
     */
    create: XOR<OrderCreateInput, OrderUncheckedCreateInput>
    /**
     * In case the Order was found with the provided `where` argument, update it with this data.
     */
    update: XOR<OrderUpdateInput, OrderUncheckedUpdateInput>
  }

  /**
   * Order delete
   */
  export type OrderDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Order
     */
    select?: OrderSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrderInclude<ExtArgs> | null
    /**
     * Filter which Order to delete.
     */
    where: OrderWhereUniqueInput
  }

  /**
   * Order deleteMany
   */
  export type OrderDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Orders to delete
     */
    where?: OrderWhereInput
  }

  /**
   * Order.customer
   */
  export type Order$customerArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Customer
     */
    select?: CustomerSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerInclude<ExtArgs> | null
    where?: CustomerWhereInput
  }

  /**
   * Order.items
   */
  export type Order$itemsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OrderItem
     */
    select?: OrderItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrderItemInclude<ExtArgs> | null
    where?: OrderItemWhereInput
    orderBy?: OrderItemOrderByWithRelationInput | OrderItemOrderByWithRelationInput[]
    cursor?: OrderItemWhereUniqueInput
    take?: number
    skip?: number
    distinct?: OrderItemScalarFieldEnum | OrderItemScalarFieldEnum[]
  }

  /**
   * Order.payments
   */
  export type Order$paymentsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Payment
     */
    select?: PaymentSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PaymentInclude<ExtArgs> | null
    where?: PaymentWhereInput
    orderBy?: PaymentOrderByWithRelationInput | PaymentOrderByWithRelationInput[]
    cursor?: PaymentWhereUniqueInput
    take?: number
    skip?: number
    distinct?: PaymentScalarFieldEnum | PaymentScalarFieldEnum[]
  }

  /**
   * Order.obligations
   */
  export type Order$obligationsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PaymentObligation
     */
    select?: PaymentObligationSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PaymentObligationInclude<ExtArgs> | null
    where?: PaymentObligationWhereInput
    orderBy?: PaymentObligationOrderByWithRelationInput | PaymentObligationOrderByWithRelationInput[]
    cursor?: PaymentObligationWhereUniqueInput
    take?: number
    skip?: number
    distinct?: PaymentObligationScalarFieldEnum | PaymentObligationScalarFieldEnum[]
  }

  /**
   * Order without action
   */
  export type OrderDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Order
     */
    select?: OrderSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrderInclude<ExtArgs> | null
  }


  /**
   * Model Payment
   */

  export type AggregatePayment = {
    _count: PaymentCountAggregateOutputType | null
    _avg: PaymentAvgAggregateOutputType | null
    _sum: PaymentSumAggregateOutputType | null
    _min: PaymentMinAggregateOutputType | null
    _max: PaymentMaxAggregateOutputType | null
  }

  export type PaymentAvgAggregateOutputType = {
    id: number | null
    customerId: number | null
    orderId: number | null
    amount: number | null
  }

  export type PaymentSumAggregateOutputType = {
    id: number | null
    customerId: number | null
    orderId: number | null
    amount: number | null
  }

  export type PaymentMinAggregateOutputType = {
    id: number | null
    customerId: number | null
    orderId: number | null
    amount: number | null
    paymentDate: Date | null
    paymentMethod: string | null
    notes: string | null
    isDeleted: boolean | null
  }

  export type PaymentMaxAggregateOutputType = {
    id: number | null
    customerId: number | null
    orderId: number | null
    amount: number | null
    paymentDate: Date | null
    paymentMethod: string | null
    notes: string | null
    isDeleted: boolean | null
  }

  export type PaymentCountAggregateOutputType = {
    id: number
    customerId: number
    orderId: number
    amount: number
    paymentDate: number
    paymentMethod: number
    notes: number
    isDeleted: number
    _all: number
  }


  export type PaymentAvgAggregateInputType = {
    id?: true
    customerId?: true
    orderId?: true
    amount?: true
  }

  export type PaymentSumAggregateInputType = {
    id?: true
    customerId?: true
    orderId?: true
    amount?: true
  }

  export type PaymentMinAggregateInputType = {
    id?: true
    customerId?: true
    orderId?: true
    amount?: true
    paymentDate?: true
    paymentMethod?: true
    notes?: true
    isDeleted?: true
  }

  export type PaymentMaxAggregateInputType = {
    id?: true
    customerId?: true
    orderId?: true
    amount?: true
    paymentDate?: true
    paymentMethod?: true
    notes?: true
    isDeleted?: true
  }

  export type PaymentCountAggregateInputType = {
    id?: true
    customerId?: true
    orderId?: true
    amount?: true
    paymentDate?: true
    paymentMethod?: true
    notes?: true
    isDeleted?: true
    _all?: true
  }

  export type PaymentAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Payment to aggregate.
     */
    where?: PaymentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Payments to fetch.
     */
    orderBy?: PaymentOrderByWithRelationInput | PaymentOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: PaymentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Payments from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Payments.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Payments
    **/
    _count?: true | PaymentCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: PaymentAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: PaymentSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: PaymentMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: PaymentMaxAggregateInputType
  }

  export type GetPaymentAggregateType<T extends PaymentAggregateArgs> = {
        [P in keyof T & keyof AggregatePayment]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregatePayment[P]>
      : GetScalarType<T[P], AggregatePayment[P]>
  }




  export type PaymentGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PaymentWhereInput
    orderBy?: PaymentOrderByWithAggregationInput | PaymentOrderByWithAggregationInput[]
    by: PaymentScalarFieldEnum[] | PaymentScalarFieldEnum
    having?: PaymentScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: PaymentCountAggregateInputType | true
    _avg?: PaymentAvgAggregateInputType
    _sum?: PaymentSumAggregateInputType
    _min?: PaymentMinAggregateInputType
    _max?: PaymentMaxAggregateInputType
  }

  export type PaymentGroupByOutputType = {
    id: number
    customerId: number | null
    orderId: number | null
    amount: number
    paymentDate: Date
    paymentMethod: string | null
    notes: string | null
    isDeleted: boolean
    _count: PaymentCountAggregateOutputType | null
    _avg: PaymentAvgAggregateOutputType | null
    _sum: PaymentSumAggregateOutputType | null
    _min: PaymentMinAggregateOutputType | null
    _max: PaymentMaxAggregateOutputType | null
  }

  type GetPaymentGroupByPayload<T extends PaymentGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<PaymentGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof PaymentGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], PaymentGroupByOutputType[P]>
            : GetScalarType<T[P], PaymentGroupByOutputType[P]>
        }
      >
    >


  export type PaymentSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    customerId?: boolean
    orderId?: boolean
    amount?: boolean
    paymentDate?: boolean
    paymentMethod?: boolean
    notes?: boolean
    isDeleted?: boolean
    customer?: boolean | Payment$customerArgs<ExtArgs>
    order?: boolean | Payment$orderArgs<ExtArgs>
  }, ExtArgs["result"]["payment"]>

  export type PaymentSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    customerId?: boolean
    orderId?: boolean
    amount?: boolean
    paymentDate?: boolean
    paymentMethod?: boolean
    notes?: boolean
    isDeleted?: boolean
    customer?: boolean | Payment$customerArgs<ExtArgs>
    order?: boolean | Payment$orderArgs<ExtArgs>
  }, ExtArgs["result"]["payment"]>

  export type PaymentSelectScalar = {
    id?: boolean
    customerId?: boolean
    orderId?: boolean
    amount?: boolean
    paymentDate?: boolean
    paymentMethod?: boolean
    notes?: boolean
    isDeleted?: boolean
  }

  export type PaymentInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    customer?: boolean | Payment$customerArgs<ExtArgs>
    order?: boolean | Payment$orderArgs<ExtArgs>
  }
  export type PaymentIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    customer?: boolean | Payment$customerArgs<ExtArgs>
    order?: boolean | Payment$orderArgs<ExtArgs>
  }

  export type $PaymentPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Payment"
    objects: {
      customer: Prisma.$CustomerPayload<ExtArgs> | null
      order: Prisma.$OrderPayload<ExtArgs> | null
    }
    scalars: $Extensions.GetPayloadResult<{
      id: number
      customerId: number | null
      orderId: number | null
      amount: number
      paymentDate: Date
      paymentMethod: string | null
      notes: string | null
      isDeleted: boolean
    }, ExtArgs["result"]["payment"]>
    composites: {}
  }

  type PaymentGetPayload<S extends boolean | null | undefined | PaymentDefaultArgs> = $Result.GetResult<Prisma.$PaymentPayload, S>

  type PaymentCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<PaymentFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: PaymentCountAggregateInputType | true
    }

  export interface PaymentDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Payment'], meta: { name: 'Payment' } }
    /**
     * Find zero or one Payment that matches the filter.
     * @param {PaymentFindUniqueArgs} args - Arguments to find a Payment
     * @example
     * // Get one Payment
     * const payment = await prisma.payment.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends PaymentFindUniqueArgs>(args: SelectSubset<T, PaymentFindUniqueArgs<ExtArgs>>): Prisma__PaymentClient<$Result.GetResult<Prisma.$PaymentPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one Payment that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {PaymentFindUniqueOrThrowArgs} args - Arguments to find a Payment
     * @example
     * // Get one Payment
     * const payment = await prisma.payment.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends PaymentFindUniqueOrThrowArgs>(args: SelectSubset<T, PaymentFindUniqueOrThrowArgs<ExtArgs>>): Prisma__PaymentClient<$Result.GetResult<Prisma.$PaymentPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first Payment that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PaymentFindFirstArgs} args - Arguments to find a Payment
     * @example
     * // Get one Payment
     * const payment = await prisma.payment.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends PaymentFindFirstArgs>(args?: SelectSubset<T, PaymentFindFirstArgs<ExtArgs>>): Prisma__PaymentClient<$Result.GetResult<Prisma.$PaymentPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first Payment that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PaymentFindFirstOrThrowArgs} args - Arguments to find a Payment
     * @example
     * // Get one Payment
     * const payment = await prisma.payment.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends PaymentFindFirstOrThrowArgs>(args?: SelectSubset<T, PaymentFindFirstOrThrowArgs<ExtArgs>>): Prisma__PaymentClient<$Result.GetResult<Prisma.$PaymentPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more Payments that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PaymentFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Payments
     * const payments = await prisma.payment.findMany()
     * 
     * // Get first 10 Payments
     * const payments = await prisma.payment.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const paymentWithIdOnly = await prisma.payment.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends PaymentFindManyArgs>(args?: SelectSubset<T, PaymentFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PaymentPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a Payment.
     * @param {PaymentCreateArgs} args - Arguments to create a Payment.
     * @example
     * // Create one Payment
     * const Payment = await prisma.payment.create({
     *   data: {
     *     // ... data to create a Payment
     *   }
     * })
     * 
     */
    create<T extends PaymentCreateArgs>(args: SelectSubset<T, PaymentCreateArgs<ExtArgs>>): Prisma__PaymentClient<$Result.GetResult<Prisma.$PaymentPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many Payments.
     * @param {PaymentCreateManyArgs} args - Arguments to create many Payments.
     * @example
     * // Create many Payments
     * const payment = await prisma.payment.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends PaymentCreateManyArgs>(args?: SelectSubset<T, PaymentCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Payments and returns the data saved in the database.
     * @param {PaymentCreateManyAndReturnArgs} args - Arguments to create many Payments.
     * @example
     * // Create many Payments
     * const payment = await prisma.payment.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Payments and only return the `id`
     * const paymentWithIdOnly = await prisma.payment.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends PaymentCreateManyAndReturnArgs>(args?: SelectSubset<T, PaymentCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PaymentPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a Payment.
     * @param {PaymentDeleteArgs} args - Arguments to delete one Payment.
     * @example
     * // Delete one Payment
     * const Payment = await prisma.payment.delete({
     *   where: {
     *     // ... filter to delete one Payment
     *   }
     * })
     * 
     */
    delete<T extends PaymentDeleteArgs>(args: SelectSubset<T, PaymentDeleteArgs<ExtArgs>>): Prisma__PaymentClient<$Result.GetResult<Prisma.$PaymentPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one Payment.
     * @param {PaymentUpdateArgs} args - Arguments to update one Payment.
     * @example
     * // Update one Payment
     * const payment = await prisma.payment.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends PaymentUpdateArgs>(args: SelectSubset<T, PaymentUpdateArgs<ExtArgs>>): Prisma__PaymentClient<$Result.GetResult<Prisma.$PaymentPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more Payments.
     * @param {PaymentDeleteManyArgs} args - Arguments to filter Payments to delete.
     * @example
     * // Delete a few Payments
     * const { count } = await prisma.payment.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends PaymentDeleteManyArgs>(args?: SelectSubset<T, PaymentDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Payments.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PaymentUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Payments
     * const payment = await prisma.payment.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends PaymentUpdateManyArgs>(args: SelectSubset<T, PaymentUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one Payment.
     * @param {PaymentUpsertArgs} args - Arguments to update or create a Payment.
     * @example
     * // Update or create a Payment
     * const payment = await prisma.payment.upsert({
     *   create: {
     *     // ... data to create a Payment
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Payment we want to update
     *   }
     * })
     */
    upsert<T extends PaymentUpsertArgs>(args: SelectSubset<T, PaymentUpsertArgs<ExtArgs>>): Prisma__PaymentClient<$Result.GetResult<Prisma.$PaymentPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of Payments.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PaymentCountArgs} args - Arguments to filter Payments to count.
     * @example
     * // Count the number of Payments
     * const count = await prisma.payment.count({
     *   where: {
     *     // ... the filter for the Payments we want to count
     *   }
     * })
    **/
    count<T extends PaymentCountArgs>(
      args?: Subset<T, PaymentCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], PaymentCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Payment.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PaymentAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends PaymentAggregateArgs>(args: Subset<T, PaymentAggregateArgs>): Prisma.PrismaPromise<GetPaymentAggregateType<T>>

    /**
     * Group by Payment.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PaymentGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends PaymentGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: PaymentGroupByArgs['orderBy'] }
        : { orderBy?: PaymentGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, PaymentGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetPaymentGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Payment model
   */
  readonly fields: PaymentFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Payment.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__PaymentClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    customer<T extends Payment$customerArgs<ExtArgs> = {}>(args?: Subset<T, Payment$customerArgs<ExtArgs>>): Prisma__CustomerClient<$Result.GetResult<Prisma.$CustomerPayload<ExtArgs>, T, "findUniqueOrThrow"> | null, null, ExtArgs>
    order<T extends Payment$orderArgs<ExtArgs> = {}>(args?: Subset<T, Payment$orderArgs<ExtArgs>>): Prisma__OrderClient<$Result.GetResult<Prisma.$OrderPayload<ExtArgs>, T, "findUniqueOrThrow"> | null, null, ExtArgs>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Payment model
   */ 
  interface PaymentFieldRefs {
    readonly id: FieldRef<"Payment", 'Int'>
    readonly customerId: FieldRef<"Payment", 'Int'>
    readonly orderId: FieldRef<"Payment", 'Int'>
    readonly amount: FieldRef<"Payment", 'Float'>
    readonly paymentDate: FieldRef<"Payment", 'DateTime'>
    readonly paymentMethod: FieldRef<"Payment", 'String'>
    readonly notes: FieldRef<"Payment", 'String'>
    readonly isDeleted: FieldRef<"Payment", 'Boolean'>
  }
    

  // Custom InputTypes
  /**
   * Payment findUnique
   */
  export type PaymentFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Payment
     */
    select?: PaymentSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PaymentInclude<ExtArgs> | null
    /**
     * Filter, which Payment to fetch.
     */
    where: PaymentWhereUniqueInput
  }

  /**
   * Payment findUniqueOrThrow
   */
  export type PaymentFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Payment
     */
    select?: PaymentSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PaymentInclude<ExtArgs> | null
    /**
     * Filter, which Payment to fetch.
     */
    where: PaymentWhereUniqueInput
  }

  /**
   * Payment findFirst
   */
  export type PaymentFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Payment
     */
    select?: PaymentSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PaymentInclude<ExtArgs> | null
    /**
     * Filter, which Payment to fetch.
     */
    where?: PaymentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Payments to fetch.
     */
    orderBy?: PaymentOrderByWithRelationInput | PaymentOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Payments.
     */
    cursor?: PaymentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Payments from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Payments.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Payments.
     */
    distinct?: PaymentScalarFieldEnum | PaymentScalarFieldEnum[]
  }

  /**
   * Payment findFirstOrThrow
   */
  export type PaymentFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Payment
     */
    select?: PaymentSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PaymentInclude<ExtArgs> | null
    /**
     * Filter, which Payment to fetch.
     */
    where?: PaymentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Payments to fetch.
     */
    orderBy?: PaymentOrderByWithRelationInput | PaymentOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Payments.
     */
    cursor?: PaymentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Payments from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Payments.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Payments.
     */
    distinct?: PaymentScalarFieldEnum | PaymentScalarFieldEnum[]
  }

  /**
   * Payment findMany
   */
  export type PaymentFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Payment
     */
    select?: PaymentSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PaymentInclude<ExtArgs> | null
    /**
     * Filter, which Payments to fetch.
     */
    where?: PaymentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Payments to fetch.
     */
    orderBy?: PaymentOrderByWithRelationInput | PaymentOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Payments.
     */
    cursor?: PaymentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Payments from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Payments.
     */
    skip?: number
    distinct?: PaymentScalarFieldEnum | PaymentScalarFieldEnum[]
  }

  /**
   * Payment create
   */
  export type PaymentCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Payment
     */
    select?: PaymentSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PaymentInclude<ExtArgs> | null
    /**
     * The data needed to create a Payment.
     */
    data: XOR<PaymentCreateInput, PaymentUncheckedCreateInput>
  }

  /**
   * Payment createMany
   */
  export type PaymentCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Payments.
     */
    data: PaymentCreateManyInput | PaymentCreateManyInput[]
  }

  /**
   * Payment createManyAndReturn
   */
  export type PaymentCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Payment
     */
    select?: PaymentSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many Payments.
     */
    data: PaymentCreateManyInput | PaymentCreateManyInput[]
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PaymentIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * Payment update
   */
  export type PaymentUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Payment
     */
    select?: PaymentSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PaymentInclude<ExtArgs> | null
    /**
     * The data needed to update a Payment.
     */
    data: XOR<PaymentUpdateInput, PaymentUncheckedUpdateInput>
    /**
     * Choose, which Payment to update.
     */
    where: PaymentWhereUniqueInput
  }

  /**
   * Payment updateMany
   */
  export type PaymentUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Payments.
     */
    data: XOR<PaymentUpdateManyMutationInput, PaymentUncheckedUpdateManyInput>
    /**
     * Filter which Payments to update
     */
    where?: PaymentWhereInput
  }

  /**
   * Payment upsert
   */
  export type PaymentUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Payment
     */
    select?: PaymentSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PaymentInclude<ExtArgs> | null
    /**
     * The filter to search for the Payment to update in case it exists.
     */
    where: PaymentWhereUniqueInput
    /**
     * In case the Payment found by the `where` argument doesn't exist, create a new Payment with this data.
     */
    create: XOR<PaymentCreateInput, PaymentUncheckedCreateInput>
    /**
     * In case the Payment was found with the provided `where` argument, update it with this data.
     */
    update: XOR<PaymentUpdateInput, PaymentUncheckedUpdateInput>
  }

  /**
   * Payment delete
   */
  export type PaymentDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Payment
     */
    select?: PaymentSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PaymentInclude<ExtArgs> | null
    /**
     * Filter which Payment to delete.
     */
    where: PaymentWhereUniqueInput
  }

  /**
   * Payment deleteMany
   */
  export type PaymentDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Payments to delete
     */
    where?: PaymentWhereInput
  }

  /**
   * Payment.customer
   */
  export type Payment$customerArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Customer
     */
    select?: CustomerSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerInclude<ExtArgs> | null
    where?: CustomerWhereInput
  }

  /**
   * Payment.order
   */
  export type Payment$orderArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Order
     */
    select?: OrderSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrderInclude<ExtArgs> | null
    where?: OrderWhereInput
  }

  /**
   * Payment without action
   */
  export type PaymentDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Payment
     */
    select?: PaymentSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PaymentInclude<ExtArgs> | null
  }


  /**
   * Model PaymentObligation
   */

  export type AggregatePaymentObligation = {
    _count: PaymentObligationCountAggregateOutputType | null
    _avg: PaymentObligationAvgAggregateOutputType | null
    _sum: PaymentObligationSumAggregateOutputType | null
    _min: PaymentObligationMinAggregateOutputType | null
    _max: PaymentObligationMaxAggregateOutputType | null
  }

  export type PaymentObligationAvgAggregateOutputType = {
    id: number | null
    orderId: number | null
    productId: number | null
    amount: number | null
    quantity: number | null
  }

  export type PaymentObligationSumAggregateOutputType = {
    id: number | null
    orderId: number | null
    productId: number | null
    amount: number | null
    quantity: number | null
  }

  export type PaymentObligationMinAggregateOutputType = {
    id: number | null
    orderId: number | null
    productId: number | null
    amount: number | null
    quantity: number | null
    description: string | null
    createdAt: Date | null
    isDeleted: boolean | null
    isRefund: boolean | null
    isManual: boolean | null
  }

  export type PaymentObligationMaxAggregateOutputType = {
    id: number | null
    orderId: number | null
    productId: number | null
    amount: number | null
    quantity: number | null
    description: string | null
    createdAt: Date | null
    isDeleted: boolean | null
    isRefund: boolean | null
    isManual: boolean | null
  }

  export type PaymentObligationCountAggregateOutputType = {
    id: number
    orderId: number
    productId: number
    amount: number
    quantity: number
    description: number
    createdAt: number
    isDeleted: number
    isRefund: number
    isManual: number
    _all: number
  }


  export type PaymentObligationAvgAggregateInputType = {
    id?: true
    orderId?: true
    productId?: true
    amount?: true
    quantity?: true
  }

  export type PaymentObligationSumAggregateInputType = {
    id?: true
    orderId?: true
    productId?: true
    amount?: true
    quantity?: true
  }

  export type PaymentObligationMinAggregateInputType = {
    id?: true
    orderId?: true
    productId?: true
    amount?: true
    quantity?: true
    description?: true
    createdAt?: true
    isDeleted?: true
    isRefund?: true
    isManual?: true
  }

  export type PaymentObligationMaxAggregateInputType = {
    id?: true
    orderId?: true
    productId?: true
    amount?: true
    quantity?: true
    description?: true
    createdAt?: true
    isDeleted?: true
    isRefund?: true
    isManual?: true
  }

  export type PaymentObligationCountAggregateInputType = {
    id?: true
    orderId?: true
    productId?: true
    amount?: true
    quantity?: true
    description?: true
    createdAt?: true
    isDeleted?: true
    isRefund?: true
    isManual?: true
    _all?: true
  }

  export type PaymentObligationAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PaymentObligation to aggregate.
     */
    where?: PaymentObligationWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PaymentObligations to fetch.
     */
    orderBy?: PaymentObligationOrderByWithRelationInput | PaymentObligationOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: PaymentObligationWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PaymentObligations from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PaymentObligations.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned PaymentObligations
    **/
    _count?: true | PaymentObligationCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: PaymentObligationAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: PaymentObligationSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: PaymentObligationMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: PaymentObligationMaxAggregateInputType
  }

  export type GetPaymentObligationAggregateType<T extends PaymentObligationAggregateArgs> = {
        [P in keyof T & keyof AggregatePaymentObligation]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregatePaymentObligation[P]>
      : GetScalarType<T[P], AggregatePaymentObligation[P]>
  }




  export type PaymentObligationGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PaymentObligationWhereInput
    orderBy?: PaymentObligationOrderByWithAggregationInput | PaymentObligationOrderByWithAggregationInput[]
    by: PaymentObligationScalarFieldEnum[] | PaymentObligationScalarFieldEnum
    having?: PaymentObligationScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: PaymentObligationCountAggregateInputType | true
    _avg?: PaymentObligationAvgAggregateInputType
    _sum?: PaymentObligationSumAggregateInputType
    _min?: PaymentObligationMinAggregateInputType
    _max?: PaymentObligationMaxAggregateInputType
  }

  export type PaymentObligationGroupByOutputType = {
    id: number
    orderId: number
    productId: number | null
    amount: number
    quantity: number
    description: string | null
    createdAt: Date
    isDeleted: boolean
    isRefund: boolean
    isManual: boolean
    _count: PaymentObligationCountAggregateOutputType | null
    _avg: PaymentObligationAvgAggregateOutputType | null
    _sum: PaymentObligationSumAggregateOutputType | null
    _min: PaymentObligationMinAggregateOutputType | null
    _max: PaymentObligationMaxAggregateOutputType | null
  }

  type GetPaymentObligationGroupByPayload<T extends PaymentObligationGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<PaymentObligationGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof PaymentObligationGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], PaymentObligationGroupByOutputType[P]>
            : GetScalarType<T[P], PaymentObligationGroupByOutputType[P]>
        }
      >
    >


  export type PaymentObligationSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    orderId?: boolean
    productId?: boolean
    amount?: boolean
    quantity?: boolean
    description?: boolean
    createdAt?: boolean
    isDeleted?: boolean
    isRefund?: boolean
    isManual?: boolean
    order?: boolean | OrderDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["paymentObligation"]>

  export type PaymentObligationSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    orderId?: boolean
    productId?: boolean
    amount?: boolean
    quantity?: boolean
    description?: boolean
    createdAt?: boolean
    isDeleted?: boolean
    isRefund?: boolean
    isManual?: boolean
    order?: boolean | OrderDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["paymentObligation"]>

  export type PaymentObligationSelectScalar = {
    id?: boolean
    orderId?: boolean
    productId?: boolean
    amount?: boolean
    quantity?: boolean
    description?: boolean
    createdAt?: boolean
    isDeleted?: boolean
    isRefund?: boolean
    isManual?: boolean
  }

  export type PaymentObligationInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    order?: boolean | OrderDefaultArgs<ExtArgs>
  }
  export type PaymentObligationIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    order?: boolean | OrderDefaultArgs<ExtArgs>
  }

  export type $PaymentObligationPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "PaymentObligation"
    objects: {
      order: Prisma.$OrderPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: number
      orderId: number
      productId: number | null
      amount: number
      quantity: number
      description: string | null
      createdAt: Date
      isDeleted: boolean
      isRefund: boolean
      isManual: boolean
    }, ExtArgs["result"]["paymentObligation"]>
    composites: {}
  }

  type PaymentObligationGetPayload<S extends boolean | null | undefined | PaymentObligationDefaultArgs> = $Result.GetResult<Prisma.$PaymentObligationPayload, S>

  type PaymentObligationCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<PaymentObligationFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: PaymentObligationCountAggregateInputType | true
    }

  export interface PaymentObligationDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['PaymentObligation'], meta: { name: 'PaymentObligation' } }
    /**
     * Find zero or one PaymentObligation that matches the filter.
     * @param {PaymentObligationFindUniqueArgs} args - Arguments to find a PaymentObligation
     * @example
     * // Get one PaymentObligation
     * const paymentObligation = await prisma.paymentObligation.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends PaymentObligationFindUniqueArgs>(args: SelectSubset<T, PaymentObligationFindUniqueArgs<ExtArgs>>): Prisma__PaymentObligationClient<$Result.GetResult<Prisma.$PaymentObligationPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one PaymentObligation that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {PaymentObligationFindUniqueOrThrowArgs} args - Arguments to find a PaymentObligation
     * @example
     * // Get one PaymentObligation
     * const paymentObligation = await prisma.paymentObligation.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends PaymentObligationFindUniqueOrThrowArgs>(args: SelectSubset<T, PaymentObligationFindUniqueOrThrowArgs<ExtArgs>>): Prisma__PaymentObligationClient<$Result.GetResult<Prisma.$PaymentObligationPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first PaymentObligation that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PaymentObligationFindFirstArgs} args - Arguments to find a PaymentObligation
     * @example
     * // Get one PaymentObligation
     * const paymentObligation = await prisma.paymentObligation.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends PaymentObligationFindFirstArgs>(args?: SelectSubset<T, PaymentObligationFindFirstArgs<ExtArgs>>): Prisma__PaymentObligationClient<$Result.GetResult<Prisma.$PaymentObligationPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first PaymentObligation that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PaymentObligationFindFirstOrThrowArgs} args - Arguments to find a PaymentObligation
     * @example
     * // Get one PaymentObligation
     * const paymentObligation = await prisma.paymentObligation.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends PaymentObligationFindFirstOrThrowArgs>(args?: SelectSubset<T, PaymentObligationFindFirstOrThrowArgs<ExtArgs>>): Prisma__PaymentObligationClient<$Result.GetResult<Prisma.$PaymentObligationPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more PaymentObligations that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PaymentObligationFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all PaymentObligations
     * const paymentObligations = await prisma.paymentObligation.findMany()
     * 
     * // Get first 10 PaymentObligations
     * const paymentObligations = await prisma.paymentObligation.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const paymentObligationWithIdOnly = await prisma.paymentObligation.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends PaymentObligationFindManyArgs>(args?: SelectSubset<T, PaymentObligationFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PaymentObligationPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a PaymentObligation.
     * @param {PaymentObligationCreateArgs} args - Arguments to create a PaymentObligation.
     * @example
     * // Create one PaymentObligation
     * const PaymentObligation = await prisma.paymentObligation.create({
     *   data: {
     *     // ... data to create a PaymentObligation
     *   }
     * })
     * 
     */
    create<T extends PaymentObligationCreateArgs>(args: SelectSubset<T, PaymentObligationCreateArgs<ExtArgs>>): Prisma__PaymentObligationClient<$Result.GetResult<Prisma.$PaymentObligationPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many PaymentObligations.
     * @param {PaymentObligationCreateManyArgs} args - Arguments to create many PaymentObligations.
     * @example
     * // Create many PaymentObligations
     * const paymentObligation = await prisma.paymentObligation.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends PaymentObligationCreateManyArgs>(args?: SelectSubset<T, PaymentObligationCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many PaymentObligations and returns the data saved in the database.
     * @param {PaymentObligationCreateManyAndReturnArgs} args - Arguments to create many PaymentObligations.
     * @example
     * // Create many PaymentObligations
     * const paymentObligation = await prisma.paymentObligation.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many PaymentObligations and only return the `id`
     * const paymentObligationWithIdOnly = await prisma.paymentObligation.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends PaymentObligationCreateManyAndReturnArgs>(args?: SelectSubset<T, PaymentObligationCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PaymentObligationPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a PaymentObligation.
     * @param {PaymentObligationDeleteArgs} args - Arguments to delete one PaymentObligation.
     * @example
     * // Delete one PaymentObligation
     * const PaymentObligation = await prisma.paymentObligation.delete({
     *   where: {
     *     // ... filter to delete one PaymentObligation
     *   }
     * })
     * 
     */
    delete<T extends PaymentObligationDeleteArgs>(args: SelectSubset<T, PaymentObligationDeleteArgs<ExtArgs>>): Prisma__PaymentObligationClient<$Result.GetResult<Prisma.$PaymentObligationPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one PaymentObligation.
     * @param {PaymentObligationUpdateArgs} args - Arguments to update one PaymentObligation.
     * @example
     * // Update one PaymentObligation
     * const paymentObligation = await prisma.paymentObligation.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends PaymentObligationUpdateArgs>(args: SelectSubset<T, PaymentObligationUpdateArgs<ExtArgs>>): Prisma__PaymentObligationClient<$Result.GetResult<Prisma.$PaymentObligationPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more PaymentObligations.
     * @param {PaymentObligationDeleteManyArgs} args - Arguments to filter PaymentObligations to delete.
     * @example
     * // Delete a few PaymentObligations
     * const { count } = await prisma.paymentObligation.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends PaymentObligationDeleteManyArgs>(args?: SelectSubset<T, PaymentObligationDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more PaymentObligations.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PaymentObligationUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many PaymentObligations
     * const paymentObligation = await prisma.paymentObligation.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends PaymentObligationUpdateManyArgs>(args: SelectSubset<T, PaymentObligationUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one PaymentObligation.
     * @param {PaymentObligationUpsertArgs} args - Arguments to update or create a PaymentObligation.
     * @example
     * // Update or create a PaymentObligation
     * const paymentObligation = await prisma.paymentObligation.upsert({
     *   create: {
     *     // ... data to create a PaymentObligation
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the PaymentObligation we want to update
     *   }
     * })
     */
    upsert<T extends PaymentObligationUpsertArgs>(args: SelectSubset<T, PaymentObligationUpsertArgs<ExtArgs>>): Prisma__PaymentObligationClient<$Result.GetResult<Prisma.$PaymentObligationPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of PaymentObligations.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PaymentObligationCountArgs} args - Arguments to filter PaymentObligations to count.
     * @example
     * // Count the number of PaymentObligations
     * const count = await prisma.paymentObligation.count({
     *   where: {
     *     // ... the filter for the PaymentObligations we want to count
     *   }
     * })
    **/
    count<T extends PaymentObligationCountArgs>(
      args?: Subset<T, PaymentObligationCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], PaymentObligationCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a PaymentObligation.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PaymentObligationAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends PaymentObligationAggregateArgs>(args: Subset<T, PaymentObligationAggregateArgs>): Prisma.PrismaPromise<GetPaymentObligationAggregateType<T>>

    /**
     * Group by PaymentObligation.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PaymentObligationGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends PaymentObligationGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: PaymentObligationGroupByArgs['orderBy'] }
        : { orderBy?: PaymentObligationGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, PaymentObligationGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetPaymentObligationGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the PaymentObligation model
   */
  readonly fields: PaymentObligationFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for PaymentObligation.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__PaymentObligationClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    order<T extends OrderDefaultArgs<ExtArgs> = {}>(args?: Subset<T, OrderDefaultArgs<ExtArgs>>): Prisma__OrderClient<$Result.GetResult<Prisma.$OrderPayload<ExtArgs>, T, "findUniqueOrThrow"> | Null, Null, ExtArgs>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the PaymentObligation model
   */ 
  interface PaymentObligationFieldRefs {
    readonly id: FieldRef<"PaymentObligation", 'Int'>
    readonly orderId: FieldRef<"PaymentObligation", 'Int'>
    readonly productId: FieldRef<"PaymentObligation", 'Int'>
    readonly amount: FieldRef<"PaymentObligation", 'Float'>
    readonly quantity: FieldRef<"PaymentObligation", 'Int'>
    readonly description: FieldRef<"PaymentObligation", 'String'>
    readonly createdAt: FieldRef<"PaymentObligation", 'DateTime'>
    readonly isDeleted: FieldRef<"PaymentObligation", 'Boolean'>
    readonly isRefund: FieldRef<"PaymentObligation", 'Boolean'>
    readonly isManual: FieldRef<"PaymentObligation", 'Boolean'>
  }
    

  // Custom InputTypes
  /**
   * PaymentObligation findUnique
   */
  export type PaymentObligationFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PaymentObligation
     */
    select?: PaymentObligationSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PaymentObligationInclude<ExtArgs> | null
    /**
     * Filter, which PaymentObligation to fetch.
     */
    where: PaymentObligationWhereUniqueInput
  }

  /**
   * PaymentObligation findUniqueOrThrow
   */
  export type PaymentObligationFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PaymentObligation
     */
    select?: PaymentObligationSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PaymentObligationInclude<ExtArgs> | null
    /**
     * Filter, which PaymentObligation to fetch.
     */
    where: PaymentObligationWhereUniqueInput
  }

  /**
   * PaymentObligation findFirst
   */
  export type PaymentObligationFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PaymentObligation
     */
    select?: PaymentObligationSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PaymentObligationInclude<ExtArgs> | null
    /**
     * Filter, which PaymentObligation to fetch.
     */
    where?: PaymentObligationWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PaymentObligations to fetch.
     */
    orderBy?: PaymentObligationOrderByWithRelationInput | PaymentObligationOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PaymentObligations.
     */
    cursor?: PaymentObligationWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PaymentObligations from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PaymentObligations.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PaymentObligations.
     */
    distinct?: PaymentObligationScalarFieldEnum | PaymentObligationScalarFieldEnum[]
  }

  /**
   * PaymentObligation findFirstOrThrow
   */
  export type PaymentObligationFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PaymentObligation
     */
    select?: PaymentObligationSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PaymentObligationInclude<ExtArgs> | null
    /**
     * Filter, which PaymentObligation to fetch.
     */
    where?: PaymentObligationWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PaymentObligations to fetch.
     */
    orderBy?: PaymentObligationOrderByWithRelationInput | PaymentObligationOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PaymentObligations.
     */
    cursor?: PaymentObligationWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PaymentObligations from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PaymentObligations.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PaymentObligations.
     */
    distinct?: PaymentObligationScalarFieldEnum | PaymentObligationScalarFieldEnum[]
  }

  /**
   * PaymentObligation findMany
   */
  export type PaymentObligationFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PaymentObligation
     */
    select?: PaymentObligationSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PaymentObligationInclude<ExtArgs> | null
    /**
     * Filter, which PaymentObligations to fetch.
     */
    where?: PaymentObligationWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PaymentObligations to fetch.
     */
    orderBy?: PaymentObligationOrderByWithRelationInput | PaymentObligationOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing PaymentObligations.
     */
    cursor?: PaymentObligationWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PaymentObligations from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PaymentObligations.
     */
    skip?: number
    distinct?: PaymentObligationScalarFieldEnum | PaymentObligationScalarFieldEnum[]
  }

  /**
   * PaymentObligation create
   */
  export type PaymentObligationCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PaymentObligation
     */
    select?: PaymentObligationSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PaymentObligationInclude<ExtArgs> | null
    /**
     * The data needed to create a PaymentObligation.
     */
    data: XOR<PaymentObligationCreateInput, PaymentObligationUncheckedCreateInput>
  }

  /**
   * PaymentObligation createMany
   */
  export type PaymentObligationCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many PaymentObligations.
     */
    data: PaymentObligationCreateManyInput | PaymentObligationCreateManyInput[]
  }

  /**
   * PaymentObligation createManyAndReturn
   */
  export type PaymentObligationCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PaymentObligation
     */
    select?: PaymentObligationSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many PaymentObligations.
     */
    data: PaymentObligationCreateManyInput | PaymentObligationCreateManyInput[]
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PaymentObligationIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * PaymentObligation update
   */
  export type PaymentObligationUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PaymentObligation
     */
    select?: PaymentObligationSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PaymentObligationInclude<ExtArgs> | null
    /**
     * The data needed to update a PaymentObligation.
     */
    data: XOR<PaymentObligationUpdateInput, PaymentObligationUncheckedUpdateInput>
    /**
     * Choose, which PaymentObligation to update.
     */
    where: PaymentObligationWhereUniqueInput
  }

  /**
   * PaymentObligation updateMany
   */
  export type PaymentObligationUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update PaymentObligations.
     */
    data: XOR<PaymentObligationUpdateManyMutationInput, PaymentObligationUncheckedUpdateManyInput>
    /**
     * Filter which PaymentObligations to update
     */
    where?: PaymentObligationWhereInput
  }

  /**
   * PaymentObligation upsert
   */
  export type PaymentObligationUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PaymentObligation
     */
    select?: PaymentObligationSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PaymentObligationInclude<ExtArgs> | null
    /**
     * The filter to search for the PaymentObligation to update in case it exists.
     */
    where: PaymentObligationWhereUniqueInput
    /**
     * In case the PaymentObligation found by the `where` argument doesn't exist, create a new PaymentObligation with this data.
     */
    create: XOR<PaymentObligationCreateInput, PaymentObligationUncheckedCreateInput>
    /**
     * In case the PaymentObligation was found with the provided `where` argument, update it with this data.
     */
    update: XOR<PaymentObligationUpdateInput, PaymentObligationUncheckedUpdateInput>
  }

  /**
   * PaymentObligation delete
   */
  export type PaymentObligationDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PaymentObligation
     */
    select?: PaymentObligationSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PaymentObligationInclude<ExtArgs> | null
    /**
     * Filter which PaymentObligation to delete.
     */
    where: PaymentObligationWhereUniqueInput
  }

  /**
   * PaymentObligation deleteMany
   */
  export type PaymentObligationDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PaymentObligations to delete
     */
    where?: PaymentObligationWhereInput
  }

  /**
   * PaymentObligation without action
   */
  export type PaymentObligationDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PaymentObligation
     */
    select?: PaymentObligationSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PaymentObligationInclude<ExtArgs> | null
  }


  /**
   * Model OrderItem
   */

  export type AggregateOrderItem = {
    _count: OrderItemCountAggregateOutputType | null
    _avg: OrderItemAvgAggregateOutputType | null
    _sum: OrderItemSumAggregateOutputType | null
    _min: OrderItemMinAggregateOutputType | null
    _max: OrderItemMaxAggregateOutputType | null
  }

  export type OrderItemAvgAggregateOutputType = {
    id: number | null
    orderId: number | null
    dressItemId: number | null
    price: number | null
    quantity: number | null
    basePrice: number | null
    finalPrice: number | null
    barcodePrefix: number | null
    neckAlteration: number | null
    sleeveAlteration: number | null
  }

  export type OrderItemSumAggregateOutputType = {
    id: number | null
    orderId: number | null
    dressItemId: number | null
    price: number | null
    quantity: number | null
    basePrice: number | null
    finalPrice: number | null
    barcodePrefix: number | null
    neckAlteration: number | null
    sleeveAlteration: number | null
  }

  export type OrderItemMinAggregateOutputType = {
    id: number | null
    orderId: number | null
    dressItemId: number | null
    price: number | null
    quantity: number | null
    description: string | null
    sizeText: string | null
    repairs: string | null
    basePrice: number | null
    finalPrice: number | null
    barcode: string | null
    barcodePrefix: number | null
    size: string | null
    isTaken: boolean | null
    isReturned: boolean | null
    returnedOk: boolean | null
    takenDate: Date | null
    returnDate: Date | null
    isDeleted: boolean | null
    deletedAt: Date | null
    neckAlteration: number | null
    lengthAlteration: string | null
    sleeveAlteration: number | null
    alterationDetails: string | null
    alterationDone: boolean | null
  }

  export type OrderItemMaxAggregateOutputType = {
    id: number | null
    orderId: number | null
    dressItemId: number | null
    price: number | null
    quantity: number | null
    description: string | null
    sizeText: string | null
    repairs: string | null
    basePrice: number | null
    finalPrice: number | null
    barcode: string | null
    barcodePrefix: number | null
    size: string | null
    isTaken: boolean | null
    isReturned: boolean | null
    returnedOk: boolean | null
    takenDate: Date | null
    returnDate: Date | null
    isDeleted: boolean | null
    deletedAt: Date | null
    neckAlteration: number | null
    lengthAlteration: string | null
    sleeveAlteration: number | null
    alterationDetails: string | null
    alterationDone: boolean | null
  }

  export type OrderItemCountAggregateOutputType = {
    id: number
    orderId: number
    dressItemId: number
    price: number
    quantity: number
    description: number
    sizeText: number
    repairs: number
    basePrice: number
    finalPrice: number
    barcode: number
    barcodePrefix: number
    size: number
    isTaken: number
    isReturned: number
    returnedOk: number
    takenDate: number
    returnDate: number
    isDeleted: number
    deletedAt: number
    neckAlteration: number
    lengthAlteration: number
    sleeveAlteration: number
    alterationDetails: number
    alterationDone: number
    _all: number
  }


  export type OrderItemAvgAggregateInputType = {
    id?: true
    orderId?: true
    dressItemId?: true
    price?: true
    quantity?: true
    basePrice?: true
    finalPrice?: true
    barcodePrefix?: true
    neckAlteration?: true
    sleeveAlteration?: true
  }

  export type OrderItemSumAggregateInputType = {
    id?: true
    orderId?: true
    dressItemId?: true
    price?: true
    quantity?: true
    basePrice?: true
    finalPrice?: true
    barcodePrefix?: true
    neckAlteration?: true
    sleeveAlteration?: true
  }

  export type OrderItemMinAggregateInputType = {
    id?: true
    orderId?: true
    dressItemId?: true
    price?: true
    quantity?: true
    description?: true
    sizeText?: true
    repairs?: true
    basePrice?: true
    finalPrice?: true
    barcode?: true
    barcodePrefix?: true
    size?: true
    isTaken?: true
    isReturned?: true
    returnedOk?: true
    takenDate?: true
    returnDate?: true
    isDeleted?: true
    deletedAt?: true
    neckAlteration?: true
    lengthAlteration?: true
    sleeveAlteration?: true
    alterationDetails?: true
    alterationDone?: true
  }

  export type OrderItemMaxAggregateInputType = {
    id?: true
    orderId?: true
    dressItemId?: true
    price?: true
    quantity?: true
    description?: true
    sizeText?: true
    repairs?: true
    basePrice?: true
    finalPrice?: true
    barcode?: true
    barcodePrefix?: true
    size?: true
    isTaken?: true
    isReturned?: true
    returnedOk?: true
    takenDate?: true
    returnDate?: true
    isDeleted?: true
    deletedAt?: true
    neckAlteration?: true
    lengthAlteration?: true
    sleeveAlteration?: true
    alterationDetails?: true
    alterationDone?: true
  }

  export type OrderItemCountAggregateInputType = {
    id?: true
    orderId?: true
    dressItemId?: true
    price?: true
    quantity?: true
    description?: true
    sizeText?: true
    repairs?: true
    basePrice?: true
    finalPrice?: true
    barcode?: true
    barcodePrefix?: true
    size?: true
    isTaken?: true
    isReturned?: true
    returnedOk?: true
    takenDate?: true
    returnDate?: true
    isDeleted?: true
    deletedAt?: true
    neckAlteration?: true
    lengthAlteration?: true
    sleeveAlteration?: true
    alterationDetails?: true
    alterationDone?: true
    _all?: true
  }

  export type OrderItemAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which OrderItem to aggregate.
     */
    where?: OrderItemWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of OrderItems to fetch.
     */
    orderBy?: OrderItemOrderByWithRelationInput | OrderItemOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: OrderItemWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` OrderItems from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` OrderItems.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned OrderItems
    **/
    _count?: true | OrderItemCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: OrderItemAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: OrderItemSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: OrderItemMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: OrderItemMaxAggregateInputType
  }

  export type GetOrderItemAggregateType<T extends OrderItemAggregateArgs> = {
        [P in keyof T & keyof AggregateOrderItem]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateOrderItem[P]>
      : GetScalarType<T[P], AggregateOrderItem[P]>
  }




  export type OrderItemGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: OrderItemWhereInput
    orderBy?: OrderItemOrderByWithAggregationInput | OrderItemOrderByWithAggregationInput[]
    by: OrderItemScalarFieldEnum[] | OrderItemScalarFieldEnum
    having?: OrderItemScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: OrderItemCountAggregateInputType | true
    _avg?: OrderItemAvgAggregateInputType
    _sum?: OrderItemSumAggregateInputType
    _min?: OrderItemMinAggregateInputType
    _max?: OrderItemMaxAggregateInputType
  }

  export type OrderItemGroupByOutputType = {
    id: number
    orderId: number | null
    dressItemId: number | null
    price: number | null
    quantity: number | null
    description: string | null
    sizeText: string | null
    repairs: string | null
    basePrice: number | null
    finalPrice: number | null
    barcode: string | null
    barcodePrefix: number | null
    size: string | null
    isTaken: boolean
    isReturned: boolean
    returnedOk: boolean
    takenDate: Date | null
    returnDate: Date | null
    isDeleted: boolean
    deletedAt: Date | null
    neckAlteration: number | null
    lengthAlteration: string | null
    sleeveAlteration: number | null
    alterationDetails: string | null
    alterationDone: boolean
    _count: OrderItemCountAggregateOutputType | null
    _avg: OrderItemAvgAggregateOutputType | null
    _sum: OrderItemSumAggregateOutputType | null
    _min: OrderItemMinAggregateOutputType | null
    _max: OrderItemMaxAggregateOutputType | null
  }

  type GetOrderItemGroupByPayload<T extends OrderItemGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<OrderItemGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof OrderItemGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], OrderItemGroupByOutputType[P]>
            : GetScalarType<T[P], OrderItemGroupByOutputType[P]>
        }
      >
    >


  export type OrderItemSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    orderId?: boolean
    dressItemId?: boolean
    price?: boolean
    quantity?: boolean
    description?: boolean
    sizeText?: boolean
    repairs?: boolean
    basePrice?: boolean
    finalPrice?: boolean
    barcode?: boolean
    barcodePrefix?: boolean
    size?: boolean
    isTaken?: boolean
    isReturned?: boolean
    returnedOk?: boolean
    takenDate?: boolean
    returnDate?: boolean
    isDeleted?: boolean
    deletedAt?: boolean
    neckAlteration?: boolean
    lengthAlteration?: boolean
    sleeveAlteration?: boolean
    alterationDetails?: boolean
    alterationDone?: boolean
    order?: boolean | OrderItem$orderArgs<ExtArgs>
    dressItem?: boolean | OrderItem$dressItemArgs<ExtArgs>
  }, ExtArgs["result"]["orderItem"]>

  export type OrderItemSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    orderId?: boolean
    dressItemId?: boolean
    price?: boolean
    quantity?: boolean
    description?: boolean
    sizeText?: boolean
    repairs?: boolean
    basePrice?: boolean
    finalPrice?: boolean
    barcode?: boolean
    barcodePrefix?: boolean
    size?: boolean
    isTaken?: boolean
    isReturned?: boolean
    returnedOk?: boolean
    takenDate?: boolean
    returnDate?: boolean
    isDeleted?: boolean
    deletedAt?: boolean
    neckAlteration?: boolean
    lengthAlteration?: boolean
    sleeveAlteration?: boolean
    alterationDetails?: boolean
    alterationDone?: boolean
    order?: boolean | OrderItem$orderArgs<ExtArgs>
    dressItem?: boolean | OrderItem$dressItemArgs<ExtArgs>
  }, ExtArgs["result"]["orderItem"]>

  export type OrderItemSelectScalar = {
    id?: boolean
    orderId?: boolean
    dressItemId?: boolean
    price?: boolean
    quantity?: boolean
    description?: boolean
    sizeText?: boolean
    repairs?: boolean
    basePrice?: boolean
    finalPrice?: boolean
    barcode?: boolean
    barcodePrefix?: boolean
    size?: boolean
    isTaken?: boolean
    isReturned?: boolean
    returnedOk?: boolean
    takenDate?: boolean
    returnDate?: boolean
    isDeleted?: boolean
    deletedAt?: boolean
    neckAlteration?: boolean
    lengthAlteration?: boolean
    sleeveAlteration?: boolean
    alterationDetails?: boolean
    alterationDone?: boolean
  }

  export type OrderItemInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    order?: boolean | OrderItem$orderArgs<ExtArgs>
    dressItem?: boolean | OrderItem$dressItemArgs<ExtArgs>
  }
  export type OrderItemIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    order?: boolean | OrderItem$orderArgs<ExtArgs>
    dressItem?: boolean | OrderItem$dressItemArgs<ExtArgs>
  }

  export type $OrderItemPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "OrderItem"
    objects: {
      order: Prisma.$OrderPayload<ExtArgs> | null
      dressItem: Prisma.$DressItemPayload<ExtArgs> | null
    }
    scalars: $Extensions.GetPayloadResult<{
      id: number
      orderId: number | null
      dressItemId: number | null
      price: number | null
      quantity: number | null
      description: string | null
      sizeText: string | null
      repairs: string | null
      basePrice: number | null
      finalPrice: number | null
      barcode: string | null
      barcodePrefix: number | null
      size: string | null
      isTaken: boolean
      isReturned: boolean
      returnedOk: boolean
      takenDate: Date | null
      returnDate: Date | null
      isDeleted: boolean
      deletedAt: Date | null
      neckAlteration: number | null
      lengthAlteration: string | null
      sleeveAlteration: number | null
      alterationDetails: string | null
      alterationDone: boolean
    }, ExtArgs["result"]["orderItem"]>
    composites: {}
  }

  type OrderItemGetPayload<S extends boolean | null | undefined | OrderItemDefaultArgs> = $Result.GetResult<Prisma.$OrderItemPayload, S>

  type OrderItemCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<OrderItemFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: OrderItemCountAggregateInputType | true
    }

  export interface OrderItemDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['OrderItem'], meta: { name: 'OrderItem' } }
    /**
     * Find zero or one OrderItem that matches the filter.
     * @param {OrderItemFindUniqueArgs} args - Arguments to find a OrderItem
     * @example
     * // Get one OrderItem
     * const orderItem = await prisma.orderItem.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends OrderItemFindUniqueArgs>(args: SelectSubset<T, OrderItemFindUniqueArgs<ExtArgs>>): Prisma__OrderItemClient<$Result.GetResult<Prisma.$OrderItemPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one OrderItem that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {OrderItemFindUniqueOrThrowArgs} args - Arguments to find a OrderItem
     * @example
     * // Get one OrderItem
     * const orderItem = await prisma.orderItem.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends OrderItemFindUniqueOrThrowArgs>(args: SelectSubset<T, OrderItemFindUniqueOrThrowArgs<ExtArgs>>): Prisma__OrderItemClient<$Result.GetResult<Prisma.$OrderItemPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first OrderItem that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrderItemFindFirstArgs} args - Arguments to find a OrderItem
     * @example
     * // Get one OrderItem
     * const orderItem = await prisma.orderItem.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends OrderItemFindFirstArgs>(args?: SelectSubset<T, OrderItemFindFirstArgs<ExtArgs>>): Prisma__OrderItemClient<$Result.GetResult<Prisma.$OrderItemPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first OrderItem that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrderItemFindFirstOrThrowArgs} args - Arguments to find a OrderItem
     * @example
     * // Get one OrderItem
     * const orderItem = await prisma.orderItem.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends OrderItemFindFirstOrThrowArgs>(args?: SelectSubset<T, OrderItemFindFirstOrThrowArgs<ExtArgs>>): Prisma__OrderItemClient<$Result.GetResult<Prisma.$OrderItemPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more OrderItems that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrderItemFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all OrderItems
     * const orderItems = await prisma.orderItem.findMany()
     * 
     * // Get first 10 OrderItems
     * const orderItems = await prisma.orderItem.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const orderItemWithIdOnly = await prisma.orderItem.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends OrderItemFindManyArgs>(args?: SelectSubset<T, OrderItemFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$OrderItemPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a OrderItem.
     * @param {OrderItemCreateArgs} args - Arguments to create a OrderItem.
     * @example
     * // Create one OrderItem
     * const OrderItem = await prisma.orderItem.create({
     *   data: {
     *     // ... data to create a OrderItem
     *   }
     * })
     * 
     */
    create<T extends OrderItemCreateArgs>(args: SelectSubset<T, OrderItemCreateArgs<ExtArgs>>): Prisma__OrderItemClient<$Result.GetResult<Prisma.$OrderItemPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many OrderItems.
     * @param {OrderItemCreateManyArgs} args - Arguments to create many OrderItems.
     * @example
     * // Create many OrderItems
     * const orderItem = await prisma.orderItem.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends OrderItemCreateManyArgs>(args?: SelectSubset<T, OrderItemCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many OrderItems and returns the data saved in the database.
     * @param {OrderItemCreateManyAndReturnArgs} args - Arguments to create many OrderItems.
     * @example
     * // Create many OrderItems
     * const orderItem = await prisma.orderItem.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many OrderItems and only return the `id`
     * const orderItemWithIdOnly = await prisma.orderItem.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends OrderItemCreateManyAndReturnArgs>(args?: SelectSubset<T, OrderItemCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$OrderItemPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a OrderItem.
     * @param {OrderItemDeleteArgs} args - Arguments to delete one OrderItem.
     * @example
     * // Delete one OrderItem
     * const OrderItem = await prisma.orderItem.delete({
     *   where: {
     *     // ... filter to delete one OrderItem
     *   }
     * })
     * 
     */
    delete<T extends OrderItemDeleteArgs>(args: SelectSubset<T, OrderItemDeleteArgs<ExtArgs>>): Prisma__OrderItemClient<$Result.GetResult<Prisma.$OrderItemPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one OrderItem.
     * @param {OrderItemUpdateArgs} args - Arguments to update one OrderItem.
     * @example
     * // Update one OrderItem
     * const orderItem = await prisma.orderItem.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends OrderItemUpdateArgs>(args: SelectSubset<T, OrderItemUpdateArgs<ExtArgs>>): Prisma__OrderItemClient<$Result.GetResult<Prisma.$OrderItemPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more OrderItems.
     * @param {OrderItemDeleteManyArgs} args - Arguments to filter OrderItems to delete.
     * @example
     * // Delete a few OrderItems
     * const { count } = await prisma.orderItem.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends OrderItemDeleteManyArgs>(args?: SelectSubset<T, OrderItemDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more OrderItems.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrderItemUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many OrderItems
     * const orderItem = await prisma.orderItem.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends OrderItemUpdateManyArgs>(args: SelectSubset<T, OrderItemUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one OrderItem.
     * @param {OrderItemUpsertArgs} args - Arguments to update or create a OrderItem.
     * @example
     * // Update or create a OrderItem
     * const orderItem = await prisma.orderItem.upsert({
     *   create: {
     *     // ... data to create a OrderItem
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the OrderItem we want to update
     *   }
     * })
     */
    upsert<T extends OrderItemUpsertArgs>(args: SelectSubset<T, OrderItemUpsertArgs<ExtArgs>>): Prisma__OrderItemClient<$Result.GetResult<Prisma.$OrderItemPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of OrderItems.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrderItemCountArgs} args - Arguments to filter OrderItems to count.
     * @example
     * // Count the number of OrderItems
     * const count = await prisma.orderItem.count({
     *   where: {
     *     // ... the filter for the OrderItems we want to count
     *   }
     * })
    **/
    count<T extends OrderItemCountArgs>(
      args?: Subset<T, OrderItemCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], OrderItemCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a OrderItem.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrderItemAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends OrderItemAggregateArgs>(args: Subset<T, OrderItemAggregateArgs>): Prisma.PrismaPromise<GetOrderItemAggregateType<T>>

    /**
     * Group by OrderItem.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrderItemGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends OrderItemGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: OrderItemGroupByArgs['orderBy'] }
        : { orderBy?: OrderItemGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, OrderItemGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetOrderItemGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the OrderItem model
   */
  readonly fields: OrderItemFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for OrderItem.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__OrderItemClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    order<T extends OrderItem$orderArgs<ExtArgs> = {}>(args?: Subset<T, OrderItem$orderArgs<ExtArgs>>): Prisma__OrderClient<$Result.GetResult<Prisma.$OrderPayload<ExtArgs>, T, "findUniqueOrThrow"> | null, null, ExtArgs>
    dressItem<T extends OrderItem$dressItemArgs<ExtArgs> = {}>(args?: Subset<T, OrderItem$dressItemArgs<ExtArgs>>): Prisma__DressItemClient<$Result.GetResult<Prisma.$DressItemPayload<ExtArgs>, T, "findUniqueOrThrow"> | null, null, ExtArgs>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the OrderItem model
   */ 
  interface OrderItemFieldRefs {
    readonly id: FieldRef<"OrderItem", 'Int'>
    readonly orderId: FieldRef<"OrderItem", 'Int'>
    readonly dressItemId: FieldRef<"OrderItem", 'Int'>
    readonly price: FieldRef<"OrderItem", 'Float'>
    readonly quantity: FieldRef<"OrderItem", 'Int'>
    readonly description: FieldRef<"OrderItem", 'String'>
    readonly sizeText: FieldRef<"OrderItem", 'String'>
    readonly repairs: FieldRef<"OrderItem", 'String'>
    readonly basePrice: FieldRef<"OrderItem", 'Float'>
    readonly finalPrice: FieldRef<"OrderItem", 'Float'>
    readonly barcode: FieldRef<"OrderItem", 'String'>
    readonly barcodePrefix: FieldRef<"OrderItem", 'Int'>
    readonly size: FieldRef<"OrderItem", 'String'>
    readonly isTaken: FieldRef<"OrderItem", 'Boolean'>
    readonly isReturned: FieldRef<"OrderItem", 'Boolean'>
    readonly returnedOk: FieldRef<"OrderItem", 'Boolean'>
    readonly takenDate: FieldRef<"OrderItem", 'DateTime'>
    readonly returnDate: FieldRef<"OrderItem", 'DateTime'>
    readonly isDeleted: FieldRef<"OrderItem", 'Boolean'>
    readonly deletedAt: FieldRef<"OrderItem", 'DateTime'>
    readonly neckAlteration: FieldRef<"OrderItem", 'Int'>
    readonly lengthAlteration: FieldRef<"OrderItem", 'String'>
    readonly sleeveAlteration: FieldRef<"OrderItem", 'Int'>
    readonly alterationDetails: FieldRef<"OrderItem", 'String'>
    readonly alterationDone: FieldRef<"OrderItem", 'Boolean'>
  }
    

  // Custom InputTypes
  /**
   * OrderItem findUnique
   */
  export type OrderItemFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OrderItem
     */
    select?: OrderItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrderItemInclude<ExtArgs> | null
    /**
     * Filter, which OrderItem to fetch.
     */
    where: OrderItemWhereUniqueInput
  }

  /**
   * OrderItem findUniqueOrThrow
   */
  export type OrderItemFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OrderItem
     */
    select?: OrderItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrderItemInclude<ExtArgs> | null
    /**
     * Filter, which OrderItem to fetch.
     */
    where: OrderItemWhereUniqueInput
  }

  /**
   * OrderItem findFirst
   */
  export type OrderItemFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OrderItem
     */
    select?: OrderItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrderItemInclude<ExtArgs> | null
    /**
     * Filter, which OrderItem to fetch.
     */
    where?: OrderItemWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of OrderItems to fetch.
     */
    orderBy?: OrderItemOrderByWithRelationInput | OrderItemOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for OrderItems.
     */
    cursor?: OrderItemWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` OrderItems from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` OrderItems.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of OrderItems.
     */
    distinct?: OrderItemScalarFieldEnum | OrderItemScalarFieldEnum[]
  }

  /**
   * OrderItem findFirstOrThrow
   */
  export type OrderItemFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OrderItem
     */
    select?: OrderItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrderItemInclude<ExtArgs> | null
    /**
     * Filter, which OrderItem to fetch.
     */
    where?: OrderItemWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of OrderItems to fetch.
     */
    orderBy?: OrderItemOrderByWithRelationInput | OrderItemOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for OrderItems.
     */
    cursor?: OrderItemWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` OrderItems from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` OrderItems.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of OrderItems.
     */
    distinct?: OrderItemScalarFieldEnum | OrderItemScalarFieldEnum[]
  }

  /**
   * OrderItem findMany
   */
  export type OrderItemFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OrderItem
     */
    select?: OrderItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrderItemInclude<ExtArgs> | null
    /**
     * Filter, which OrderItems to fetch.
     */
    where?: OrderItemWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of OrderItems to fetch.
     */
    orderBy?: OrderItemOrderByWithRelationInput | OrderItemOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing OrderItems.
     */
    cursor?: OrderItemWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` OrderItems from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` OrderItems.
     */
    skip?: number
    distinct?: OrderItemScalarFieldEnum | OrderItemScalarFieldEnum[]
  }

  /**
   * OrderItem create
   */
  export type OrderItemCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OrderItem
     */
    select?: OrderItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrderItemInclude<ExtArgs> | null
    /**
     * The data needed to create a OrderItem.
     */
    data?: XOR<OrderItemCreateInput, OrderItemUncheckedCreateInput>
  }

  /**
   * OrderItem createMany
   */
  export type OrderItemCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many OrderItems.
     */
    data: OrderItemCreateManyInput | OrderItemCreateManyInput[]
  }

  /**
   * OrderItem createManyAndReturn
   */
  export type OrderItemCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OrderItem
     */
    select?: OrderItemSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many OrderItems.
     */
    data: OrderItemCreateManyInput | OrderItemCreateManyInput[]
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrderItemIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * OrderItem update
   */
  export type OrderItemUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OrderItem
     */
    select?: OrderItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrderItemInclude<ExtArgs> | null
    /**
     * The data needed to update a OrderItem.
     */
    data: XOR<OrderItemUpdateInput, OrderItemUncheckedUpdateInput>
    /**
     * Choose, which OrderItem to update.
     */
    where: OrderItemWhereUniqueInput
  }

  /**
   * OrderItem updateMany
   */
  export type OrderItemUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update OrderItems.
     */
    data: XOR<OrderItemUpdateManyMutationInput, OrderItemUncheckedUpdateManyInput>
    /**
     * Filter which OrderItems to update
     */
    where?: OrderItemWhereInput
  }

  /**
   * OrderItem upsert
   */
  export type OrderItemUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OrderItem
     */
    select?: OrderItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrderItemInclude<ExtArgs> | null
    /**
     * The filter to search for the OrderItem to update in case it exists.
     */
    where: OrderItemWhereUniqueInput
    /**
     * In case the OrderItem found by the `where` argument doesn't exist, create a new OrderItem with this data.
     */
    create: XOR<OrderItemCreateInput, OrderItemUncheckedCreateInput>
    /**
     * In case the OrderItem was found with the provided `where` argument, update it with this data.
     */
    update: XOR<OrderItemUpdateInput, OrderItemUncheckedUpdateInput>
  }

  /**
   * OrderItem delete
   */
  export type OrderItemDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OrderItem
     */
    select?: OrderItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrderItemInclude<ExtArgs> | null
    /**
     * Filter which OrderItem to delete.
     */
    where: OrderItemWhereUniqueInput
  }

  /**
   * OrderItem deleteMany
   */
  export type OrderItemDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which OrderItems to delete
     */
    where?: OrderItemWhereInput
  }

  /**
   * OrderItem.order
   */
  export type OrderItem$orderArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Order
     */
    select?: OrderSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrderInclude<ExtArgs> | null
    where?: OrderWhereInput
  }

  /**
   * OrderItem.dressItem
   */
  export type OrderItem$dressItemArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DressItem
     */
    select?: DressItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DressItemInclude<ExtArgs> | null
    where?: DressItemWhereInput
  }

  /**
   * OrderItem without action
   */
  export type OrderItemDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OrderItem
     */
    select?: OrderItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrderItemInclude<ExtArgs> | null
  }


  /**
   * Model PriceList
   */

  export type AggregatePriceList = {
    _count: PriceListCountAggregateOutputType | null
    _avg: PriceListAvgAggregateOutputType | null
    _sum: PriceListSumAggregateOutputType | null
    _min: PriceListMinAggregateOutputType | null
    _max: PriceListMaxAggregateOutputType | null
  }

  export type PriceListAvgAggregateOutputType = {
    id: number | null
    fromSize: number | null
    toSize: number | null
    price: number | null
    deposit: number | null
  }

  export type PriceListSumAggregateOutputType = {
    id: number | null
    fromSize: number | null
    toSize: number | null
    price: number | null
    deposit: number | null
  }

  export type PriceListMinAggregateOutputType = {
    id: number | null
    description: string | null
    fromSize: number | null
    toSize: number | null
    price: number | null
    startDate: Date | null
    endDate: Date | null
    category: string | null
    deposit: number | null
  }

  export type PriceListMaxAggregateOutputType = {
    id: number | null
    description: string | null
    fromSize: number | null
    toSize: number | null
    price: number | null
    startDate: Date | null
    endDate: Date | null
    category: string | null
    deposit: number | null
  }

  export type PriceListCountAggregateOutputType = {
    id: number
    description: number
    fromSize: number
    toSize: number
    price: number
    startDate: number
    endDate: number
    category: number
    deposit: number
    _all: number
  }


  export type PriceListAvgAggregateInputType = {
    id?: true
    fromSize?: true
    toSize?: true
    price?: true
    deposit?: true
  }

  export type PriceListSumAggregateInputType = {
    id?: true
    fromSize?: true
    toSize?: true
    price?: true
    deposit?: true
  }

  export type PriceListMinAggregateInputType = {
    id?: true
    description?: true
    fromSize?: true
    toSize?: true
    price?: true
    startDate?: true
    endDate?: true
    category?: true
    deposit?: true
  }

  export type PriceListMaxAggregateInputType = {
    id?: true
    description?: true
    fromSize?: true
    toSize?: true
    price?: true
    startDate?: true
    endDate?: true
    category?: true
    deposit?: true
  }

  export type PriceListCountAggregateInputType = {
    id?: true
    description?: true
    fromSize?: true
    toSize?: true
    price?: true
    startDate?: true
    endDate?: true
    category?: true
    deposit?: true
    _all?: true
  }

  export type PriceListAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PriceList to aggregate.
     */
    where?: PriceListWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PriceLists to fetch.
     */
    orderBy?: PriceListOrderByWithRelationInput | PriceListOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: PriceListWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PriceLists from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PriceLists.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned PriceLists
    **/
    _count?: true | PriceListCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: PriceListAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: PriceListSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: PriceListMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: PriceListMaxAggregateInputType
  }

  export type GetPriceListAggregateType<T extends PriceListAggregateArgs> = {
        [P in keyof T & keyof AggregatePriceList]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregatePriceList[P]>
      : GetScalarType<T[P], AggregatePriceList[P]>
  }




  export type PriceListGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PriceListWhereInput
    orderBy?: PriceListOrderByWithAggregationInput | PriceListOrderByWithAggregationInput[]
    by: PriceListScalarFieldEnum[] | PriceListScalarFieldEnum
    having?: PriceListScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: PriceListCountAggregateInputType | true
    _avg?: PriceListAvgAggregateInputType
    _sum?: PriceListSumAggregateInputType
    _min?: PriceListMinAggregateInputType
    _max?: PriceListMaxAggregateInputType
  }

  export type PriceListGroupByOutputType = {
    id: number
    description: string | null
    fromSize: number | null
    toSize: number | null
    price: number | null
    startDate: Date | null
    endDate: Date | null
    category: string | null
    deposit: number | null
    _count: PriceListCountAggregateOutputType | null
    _avg: PriceListAvgAggregateOutputType | null
    _sum: PriceListSumAggregateOutputType | null
    _min: PriceListMinAggregateOutputType | null
    _max: PriceListMaxAggregateOutputType | null
  }

  type GetPriceListGroupByPayload<T extends PriceListGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<PriceListGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof PriceListGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], PriceListGroupByOutputType[P]>
            : GetScalarType<T[P], PriceListGroupByOutputType[P]>
        }
      >
    >


  export type PriceListSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    description?: boolean
    fromSize?: boolean
    toSize?: boolean
    price?: boolean
    startDate?: boolean
    endDate?: boolean
    category?: boolean
    deposit?: boolean
  }, ExtArgs["result"]["priceList"]>

  export type PriceListSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    description?: boolean
    fromSize?: boolean
    toSize?: boolean
    price?: boolean
    startDate?: boolean
    endDate?: boolean
    category?: boolean
    deposit?: boolean
  }, ExtArgs["result"]["priceList"]>

  export type PriceListSelectScalar = {
    id?: boolean
    description?: boolean
    fromSize?: boolean
    toSize?: boolean
    price?: boolean
    startDate?: boolean
    endDate?: boolean
    category?: boolean
    deposit?: boolean
  }


  export type $PriceListPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "PriceList"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: number
      description: string | null
      fromSize: number | null
      toSize: number | null
      price: number | null
      startDate: Date | null
      endDate: Date | null
      category: string | null
      deposit: number | null
    }, ExtArgs["result"]["priceList"]>
    composites: {}
  }

  type PriceListGetPayload<S extends boolean | null | undefined | PriceListDefaultArgs> = $Result.GetResult<Prisma.$PriceListPayload, S>

  type PriceListCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<PriceListFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: PriceListCountAggregateInputType | true
    }

  export interface PriceListDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['PriceList'], meta: { name: 'PriceList' } }
    /**
     * Find zero or one PriceList that matches the filter.
     * @param {PriceListFindUniqueArgs} args - Arguments to find a PriceList
     * @example
     * // Get one PriceList
     * const priceList = await prisma.priceList.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends PriceListFindUniqueArgs>(args: SelectSubset<T, PriceListFindUniqueArgs<ExtArgs>>): Prisma__PriceListClient<$Result.GetResult<Prisma.$PriceListPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one PriceList that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {PriceListFindUniqueOrThrowArgs} args - Arguments to find a PriceList
     * @example
     * // Get one PriceList
     * const priceList = await prisma.priceList.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends PriceListFindUniqueOrThrowArgs>(args: SelectSubset<T, PriceListFindUniqueOrThrowArgs<ExtArgs>>): Prisma__PriceListClient<$Result.GetResult<Prisma.$PriceListPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first PriceList that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PriceListFindFirstArgs} args - Arguments to find a PriceList
     * @example
     * // Get one PriceList
     * const priceList = await prisma.priceList.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends PriceListFindFirstArgs>(args?: SelectSubset<T, PriceListFindFirstArgs<ExtArgs>>): Prisma__PriceListClient<$Result.GetResult<Prisma.$PriceListPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first PriceList that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PriceListFindFirstOrThrowArgs} args - Arguments to find a PriceList
     * @example
     * // Get one PriceList
     * const priceList = await prisma.priceList.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends PriceListFindFirstOrThrowArgs>(args?: SelectSubset<T, PriceListFindFirstOrThrowArgs<ExtArgs>>): Prisma__PriceListClient<$Result.GetResult<Prisma.$PriceListPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more PriceLists that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PriceListFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all PriceLists
     * const priceLists = await prisma.priceList.findMany()
     * 
     * // Get first 10 PriceLists
     * const priceLists = await prisma.priceList.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const priceListWithIdOnly = await prisma.priceList.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends PriceListFindManyArgs>(args?: SelectSubset<T, PriceListFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PriceListPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a PriceList.
     * @param {PriceListCreateArgs} args - Arguments to create a PriceList.
     * @example
     * // Create one PriceList
     * const PriceList = await prisma.priceList.create({
     *   data: {
     *     // ... data to create a PriceList
     *   }
     * })
     * 
     */
    create<T extends PriceListCreateArgs>(args: SelectSubset<T, PriceListCreateArgs<ExtArgs>>): Prisma__PriceListClient<$Result.GetResult<Prisma.$PriceListPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many PriceLists.
     * @param {PriceListCreateManyArgs} args - Arguments to create many PriceLists.
     * @example
     * // Create many PriceLists
     * const priceList = await prisma.priceList.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends PriceListCreateManyArgs>(args?: SelectSubset<T, PriceListCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many PriceLists and returns the data saved in the database.
     * @param {PriceListCreateManyAndReturnArgs} args - Arguments to create many PriceLists.
     * @example
     * // Create many PriceLists
     * const priceList = await prisma.priceList.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many PriceLists and only return the `id`
     * const priceListWithIdOnly = await prisma.priceList.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends PriceListCreateManyAndReturnArgs>(args?: SelectSubset<T, PriceListCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PriceListPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a PriceList.
     * @param {PriceListDeleteArgs} args - Arguments to delete one PriceList.
     * @example
     * // Delete one PriceList
     * const PriceList = await prisma.priceList.delete({
     *   where: {
     *     // ... filter to delete one PriceList
     *   }
     * })
     * 
     */
    delete<T extends PriceListDeleteArgs>(args: SelectSubset<T, PriceListDeleteArgs<ExtArgs>>): Prisma__PriceListClient<$Result.GetResult<Prisma.$PriceListPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one PriceList.
     * @param {PriceListUpdateArgs} args - Arguments to update one PriceList.
     * @example
     * // Update one PriceList
     * const priceList = await prisma.priceList.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends PriceListUpdateArgs>(args: SelectSubset<T, PriceListUpdateArgs<ExtArgs>>): Prisma__PriceListClient<$Result.GetResult<Prisma.$PriceListPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more PriceLists.
     * @param {PriceListDeleteManyArgs} args - Arguments to filter PriceLists to delete.
     * @example
     * // Delete a few PriceLists
     * const { count } = await prisma.priceList.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends PriceListDeleteManyArgs>(args?: SelectSubset<T, PriceListDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more PriceLists.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PriceListUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many PriceLists
     * const priceList = await prisma.priceList.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends PriceListUpdateManyArgs>(args: SelectSubset<T, PriceListUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one PriceList.
     * @param {PriceListUpsertArgs} args - Arguments to update or create a PriceList.
     * @example
     * // Update or create a PriceList
     * const priceList = await prisma.priceList.upsert({
     *   create: {
     *     // ... data to create a PriceList
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the PriceList we want to update
     *   }
     * })
     */
    upsert<T extends PriceListUpsertArgs>(args: SelectSubset<T, PriceListUpsertArgs<ExtArgs>>): Prisma__PriceListClient<$Result.GetResult<Prisma.$PriceListPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of PriceLists.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PriceListCountArgs} args - Arguments to filter PriceLists to count.
     * @example
     * // Count the number of PriceLists
     * const count = await prisma.priceList.count({
     *   where: {
     *     // ... the filter for the PriceLists we want to count
     *   }
     * })
    **/
    count<T extends PriceListCountArgs>(
      args?: Subset<T, PriceListCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], PriceListCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a PriceList.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PriceListAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends PriceListAggregateArgs>(args: Subset<T, PriceListAggregateArgs>): Prisma.PrismaPromise<GetPriceListAggregateType<T>>

    /**
     * Group by PriceList.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PriceListGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends PriceListGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: PriceListGroupByArgs['orderBy'] }
        : { orderBy?: PriceListGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, PriceListGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetPriceListGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the PriceList model
   */
  readonly fields: PriceListFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for PriceList.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__PriceListClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the PriceList model
   */ 
  interface PriceListFieldRefs {
    readonly id: FieldRef<"PriceList", 'Int'>
    readonly description: FieldRef<"PriceList", 'String'>
    readonly fromSize: FieldRef<"PriceList", 'Int'>
    readonly toSize: FieldRef<"PriceList", 'Int'>
    readonly price: FieldRef<"PriceList", 'Float'>
    readonly startDate: FieldRef<"PriceList", 'DateTime'>
    readonly endDate: FieldRef<"PriceList", 'DateTime'>
    readonly category: FieldRef<"PriceList", 'String'>
    readonly deposit: FieldRef<"PriceList", 'Float'>
  }
    

  // Custom InputTypes
  /**
   * PriceList findUnique
   */
  export type PriceListFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PriceList
     */
    select?: PriceListSelect<ExtArgs> | null
    /**
     * Filter, which PriceList to fetch.
     */
    where: PriceListWhereUniqueInput
  }

  /**
   * PriceList findUniqueOrThrow
   */
  export type PriceListFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PriceList
     */
    select?: PriceListSelect<ExtArgs> | null
    /**
     * Filter, which PriceList to fetch.
     */
    where: PriceListWhereUniqueInput
  }

  /**
   * PriceList findFirst
   */
  export type PriceListFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PriceList
     */
    select?: PriceListSelect<ExtArgs> | null
    /**
     * Filter, which PriceList to fetch.
     */
    where?: PriceListWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PriceLists to fetch.
     */
    orderBy?: PriceListOrderByWithRelationInput | PriceListOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PriceLists.
     */
    cursor?: PriceListWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PriceLists from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PriceLists.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PriceLists.
     */
    distinct?: PriceListScalarFieldEnum | PriceListScalarFieldEnum[]
  }

  /**
   * PriceList findFirstOrThrow
   */
  export type PriceListFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PriceList
     */
    select?: PriceListSelect<ExtArgs> | null
    /**
     * Filter, which PriceList to fetch.
     */
    where?: PriceListWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PriceLists to fetch.
     */
    orderBy?: PriceListOrderByWithRelationInput | PriceListOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PriceLists.
     */
    cursor?: PriceListWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PriceLists from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PriceLists.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PriceLists.
     */
    distinct?: PriceListScalarFieldEnum | PriceListScalarFieldEnum[]
  }

  /**
   * PriceList findMany
   */
  export type PriceListFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PriceList
     */
    select?: PriceListSelect<ExtArgs> | null
    /**
     * Filter, which PriceLists to fetch.
     */
    where?: PriceListWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PriceLists to fetch.
     */
    orderBy?: PriceListOrderByWithRelationInput | PriceListOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing PriceLists.
     */
    cursor?: PriceListWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PriceLists from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PriceLists.
     */
    skip?: number
    distinct?: PriceListScalarFieldEnum | PriceListScalarFieldEnum[]
  }

  /**
   * PriceList create
   */
  export type PriceListCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PriceList
     */
    select?: PriceListSelect<ExtArgs> | null
    /**
     * The data needed to create a PriceList.
     */
    data?: XOR<PriceListCreateInput, PriceListUncheckedCreateInput>
  }

  /**
   * PriceList createMany
   */
  export type PriceListCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many PriceLists.
     */
    data: PriceListCreateManyInput | PriceListCreateManyInput[]
  }

  /**
   * PriceList createManyAndReturn
   */
  export type PriceListCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PriceList
     */
    select?: PriceListSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many PriceLists.
     */
    data: PriceListCreateManyInput | PriceListCreateManyInput[]
  }

  /**
   * PriceList update
   */
  export type PriceListUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PriceList
     */
    select?: PriceListSelect<ExtArgs> | null
    /**
     * The data needed to update a PriceList.
     */
    data: XOR<PriceListUpdateInput, PriceListUncheckedUpdateInput>
    /**
     * Choose, which PriceList to update.
     */
    where: PriceListWhereUniqueInput
  }

  /**
   * PriceList updateMany
   */
  export type PriceListUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update PriceLists.
     */
    data: XOR<PriceListUpdateManyMutationInput, PriceListUncheckedUpdateManyInput>
    /**
     * Filter which PriceLists to update
     */
    where?: PriceListWhereInput
  }

  /**
   * PriceList upsert
   */
  export type PriceListUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PriceList
     */
    select?: PriceListSelect<ExtArgs> | null
    /**
     * The filter to search for the PriceList to update in case it exists.
     */
    where: PriceListWhereUniqueInput
    /**
     * In case the PriceList found by the `where` argument doesn't exist, create a new PriceList with this data.
     */
    create: XOR<PriceListCreateInput, PriceListUncheckedCreateInput>
    /**
     * In case the PriceList was found with the provided `where` argument, update it with this data.
     */
    update: XOR<PriceListUpdateInput, PriceListUncheckedUpdateInput>
  }

  /**
   * PriceList delete
   */
  export type PriceListDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PriceList
     */
    select?: PriceListSelect<ExtArgs> | null
    /**
     * Filter which PriceList to delete.
     */
    where: PriceListWhereUniqueInput
  }

  /**
   * PriceList deleteMany
   */
  export type PriceListDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PriceLists to delete
     */
    where?: PriceListWhereInput
  }

  /**
   * PriceList without action
   */
  export type PriceListDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PriceList
     */
    select?: PriceListSelect<ExtArgs> | null
  }


  /**
   * Model SystemSetting
   */

  export type AggregateSystemSetting = {
    _count: SystemSettingCountAggregateOutputType | null
    _avg: SystemSettingAvgAggregateOutputType | null
    _sum: SystemSettingSumAggregateOutputType | null
    _min: SystemSettingMinAggregateOutputType | null
    _max: SystemSettingMaxAggregateOutputType | null
  }

  export type SystemSettingAvgAggregateOutputType = {
    id: number | null
  }

  export type SystemSettingSumAggregateOutputType = {
    id: number | null
  }

  export type SystemSettingMinAggregateOutputType = {
    id: number | null
    key: string | null
    value: string | null
    name: string | null
    category: string | null
    notes: string | null
    type: string | null
  }

  export type SystemSettingMaxAggregateOutputType = {
    id: number | null
    key: string | null
    value: string | null
    name: string | null
    category: string | null
    notes: string | null
    type: string | null
  }

  export type SystemSettingCountAggregateOutputType = {
    id: number
    key: number
    value: number
    name: number
    category: number
    notes: number
    type: number
    _all: number
  }


  export type SystemSettingAvgAggregateInputType = {
    id?: true
  }

  export type SystemSettingSumAggregateInputType = {
    id?: true
  }

  export type SystemSettingMinAggregateInputType = {
    id?: true
    key?: true
    value?: true
    name?: true
    category?: true
    notes?: true
    type?: true
  }

  export type SystemSettingMaxAggregateInputType = {
    id?: true
    key?: true
    value?: true
    name?: true
    category?: true
    notes?: true
    type?: true
  }

  export type SystemSettingCountAggregateInputType = {
    id?: true
    key?: true
    value?: true
    name?: true
    category?: true
    notes?: true
    type?: true
    _all?: true
  }

  export type SystemSettingAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which SystemSetting to aggregate.
     */
    where?: SystemSettingWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SystemSettings to fetch.
     */
    orderBy?: SystemSettingOrderByWithRelationInput | SystemSettingOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: SystemSettingWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SystemSettings from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SystemSettings.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned SystemSettings
    **/
    _count?: true | SystemSettingCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: SystemSettingAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: SystemSettingSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: SystemSettingMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: SystemSettingMaxAggregateInputType
  }

  export type GetSystemSettingAggregateType<T extends SystemSettingAggregateArgs> = {
        [P in keyof T & keyof AggregateSystemSetting]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateSystemSetting[P]>
      : GetScalarType<T[P], AggregateSystemSetting[P]>
  }




  export type SystemSettingGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: SystemSettingWhereInput
    orderBy?: SystemSettingOrderByWithAggregationInput | SystemSettingOrderByWithAggregationInput[]
    by: SystemSettingScalarFieldEnum[] | SystemSettingScalarFieldEnum
    having?: SystemSettingScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: SystemSettingCountAggregateInputType | true
    _avg?: SystemSettingAvgAggregateInputType
    _sum?: SystemSettingSumAggregateInputType
    _min?: SystemSettingMinAggregateInputType
    _max?: SystemSettingMaxAggregateInputType
  }

  export type SystemSettingGroupByOutputType = {
    id: number
    key: string
    value: string | null
    name: string | null
    category: string | null
    notes: string | null
    type: string
    _count: SystemSettingCountAggregateOutputType | null
    _avg: SystemSettingAvgAggregateOutputType | null
    _sum: SystemSettingSumAggregateOutputType | null
    _min: SystemSettingMinAggregateOutputType | null
    _max: SystemSettingMaxAggregateOutputType | null
  }

  type GetSystemSettingGroupByPayload<T extends SystemSettingGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<SystemSettingGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof SystemSettingGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], SystemSettingGroupByOutputType[P]>
            : GetScalarType<T[P], SystemSettingGroupByOutputType[P]>
        }
      >
    >


  export type SystemSettingSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    key?: boolean
    value?: boolean
    name?: boolean
    category?: boolean
    notes?: boolean
    type?: boolean
  }, ExtArgs["result"]["systemSetting"]>

  export type SystemSettingSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    key?: boolean
    value?: boolean
    name?: boolean
    category?: boolean
    notes?: boolean
    type?: boolean
  }, ExtArgs["result"]["systemSetting"]>

  export type SystemSettingSelectScalar = {
    id?: boolean
    key?: boolean
    value?: boolean
    name?: boolean
    category?: boolean
    notes?: boolean
    type?: boolean
  }


  export type $SystemSettingPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "SystemSetting"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: number
      key: string
      value: string | null
      name: string | null
      category: string | null
      notes: string | null
      type: string
    }, ExtArgs["result"]["systemSetting"]>
    composites: {}
  }

  type SystemSettingGetPayload<S extends boolean | null | undefined | SystemSettingDefaultArgs> = $Result.GetResult<Prisma.$SystemSettingPayload, S>

  type SystemSettingCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<SystemSettingFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: SystemSettingCountAggregateInputType | true
    }

  export interface SystemSettingDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['SystemSetting'], meta: { name: 'SystemSetting' } }
    /**
     * Find zero or one SystemSetting that matches the filter.
     * @param {SystemSettingFindUniqueArgs} args - Arguments to find a SystemSetting
     * @example
     * // Get one SystemSetting
     * const systemSetting = await prisma.systemSetting.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends SystemSettingFindUniqueArgs>(args: SelectSubset<T, SystemSettingFindUniqueArgs<ExtArgs>>): Prisma__SystemSettingClient<$Result.GetResult<Prisma.$SystemSettingPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one SystemSetting that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {SystemSettingFindUniqueOrThrowArgs} args - Arguments to find a SystemSetting
     * @example
     * // Get one SystemSetting
     * const systemSetting = await prisma.systemSetting.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends SystemSettingFindUniqueOrThrowArgs>(args: SelectSubset<T, SystemSettingFindUniqueOrThrowArgs<ExtArgs>>): Prisma__SystemSettingClient<$Result.GetResult<Prisma.$SystemSettingPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first SystemSetting that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SystemSettingFindFirstArgs} args - Arguments to find a SystemSetting
     * @example
     * // Get one SystemSetting
     * const systemSetting = await prisma.systemSetting.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends SystemSettingFindFirstArgs>(args?: SelectSubset<T, SystemSettingFindFirstArgs<ExtArgs>>): Prisma__SystemSettingClient<$Result.GetResult<Prisma.$SystemSettingPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first SystemSetting that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SystemSettingFindFirstOrThrowArgs} args - Arguments to find a SystemSetting
     * @example
     * // Get one SystemSetting
     * const systemSetting = await prisma.systemSetting.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends SystemSettingFindFirstOrThrowArgs>(args?: SelectSubset<T, SystemSettingFindFirstOrThrowArgs<ExtArgs>>): Prisma__SystemSettingClient<$Result.GetResult<Prisma.$SystemSettingPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more SystemSettings that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SystemSettingFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all SystemSettings
     * const systemSettings = await prisma.systemSetting.findMany()
     * 
     * // Get first 10 SystemSettings
     * const systemSettings = await prisma.systemSetting.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const systemSettingWithIdOnly = await prisma.systemSetting.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends SystemSettingFindManyArgs>(args?: SelectSubset<T, SystemSettingFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SystemSettingPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a SystemSetting.
     * @param {SystemSettingCreateArgs} args - Arguments to create a SystemSetting.
     * @example
     * // Create one SystemSetting
     * const SystemSetting = await prisma.systemSetting.create({
     *   data: {
     *     // ... data to create a SystemSetting
     *   }
     * })
     * 
     */
    create<T extends SystemSettingCreateArgs>(args: SelectSubset<T, SystemSettingCreateArgs<ExtArgs>>): Prisma__SystemSettingClient<$Result.GetResult<Prisma.$SystemSettingPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many SystemSettings.
     * @param {SystemSettingCreateManyArgs} args - Arguments to create many SystemSettings.
     * @example
     * // Create many SystemSettings
     * const systemSetting = await prisma.systemSetting.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends SystemSettingCreateManyArgs>(args?: SelectSubset<T, SystemSettingCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many SystemSettings and returns the data saved in the database.
     * @param {SystemSettingCreateManyAndReturnArgs} args - Arguments to create many SystemSettings.
     * @example
     * // Create many SystemSettings
     * const systemSetting = await prisma.systemSetting.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many SystemSettings and only return the `id`
     * const systemSettingWithIdOnly = await prisma.systemSetting.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends SystemSettingCreateManyAndReturnArgs>(args?: SelectSubset<T, SystemSettingCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SystemSettingPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a SystemSetting.
     * @param {SystemSettingDeleteArgs} args - Arguments to delete one SystemSetting.
     * @example
     * // Delete one SystemSetting
     * const SystemSetting = await prisma.systemSetting.delete({
     *   where: {
     *     // ... filter to delete one SystemSetting
     *   }
     * })
     * 
     */
    delete<T extends SystemSettingDeleteArgs>(args: SelectSubset<T, SystemSettingDeleteArgs<ExtArgs>>): Prisma__SystemSettingClient<$Result.GetResult<Prisma.$SystemSettingPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one SystemSetting.
     * @param {SystemSettingUpdateArgs} args - Arguments to update one SystemSetting.
     * @example
     * // Update one SystemSetting
     * const systemSetting = await prisma.systemSetting.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends SystemSettingUpdateArgs>(args: SelectSubset<T, SystemSettingUpdateArgs<ExtArgs>>): Prisma__SystemSettingClient<$Result.GetResult<Prisma.$SystemSettingPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more SystemSettings.
     * @param {SystemSettingDeleteManyArgs} args - Arguments to filter SystemSettings to delete.
     * @example
     * // Delete a few SystemSettings
     * const { count } = await prisma.systemSetting.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends SystemSettingDeleteManyArgs>(args?: SelectSubset<T, SystemSettingDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more SystemSettings.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SystemSettingUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many SystemSettings
     * const systemSetting = await prisma.systemSetting.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends SystemSettingUpdateManyArgs>(args: SelectSubset<T, SystemSettingUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one SystemSetting.
     * @param {SystemSettingUpsertArgs} args - Arguments to update or create a SystemSetting.
     * @example
     * // Update or create a SystemSetting
     * const systemSetting = await prisma.systemSetting.upsert({
     *   create: {
     *     // ... data to create a SystemSetting
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the SystemSetting we want to update
     *   }
     * })
     */
    upsert<T extends SystemSettingUpsertArgs>(args: SelectSubset<T, SystemSettingUpsertArgs<ExtArgs>>): Prisma__SystemSettingClient<$Result.GetResult<Prisma.$SystemSettingPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of SystemSettings.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SystemSettingCountArgs} args - Arguments to filter SystemSettings to count.
     * @example
     * // Count the number of SystemSettings
     * const count = await prisma.systemSetting.count({
     *   where: {
     *     // ... the filter for the SystemSettings we want to count
     *   }
     * })
    **/
    count<T extends SystemSettingCountArgs>(
      args?: Subset<T, SystemSettingCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], SystemSettingCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a SystemSetting.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SystemSettingAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends SystemSettingAggregateArgs>(args: Subset<T, SystemSettingAggregateArgs>): Prisma.PrismaPromise<GetSystemSettingAggregateType<T>>

    /**
     * Group by SystemSetting.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SystemSettingGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends SystemSettingGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: SystemSettingGroupByArgs['orderBy'] }
        : { orderBy?: SystemSettingGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, SystemSettingGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetSystemSettingGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the SystemSetting model
   */
  readonly fields: SystemSettingFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for SystemSetting.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__SystemSettingClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the SystemSetting model
   */ 
  interface SystemSettingFieldRefs {
    readonly id: FieldRef<"SystemSetting", 'Int'>
    readonly key: FieldRef<"SystemSetting", 'String'>
    readonly value: FieldRef<"SystemSetting", 'String'>
    readonly name: FieldRef<"SystemSetting", 'String'>
    readonly category: FieldRef<"SystemSetting", 'String'>
    readonly notes: FieldRef<"SystemSetting", 'String'>
    readonly type: FieldRef<"SystemSetting", 'String'>
  }
    

  // Custom InputTypes
  /**
   * SystemSetting findUnique
   */
  export type SystemSettingFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SystemSetting
     */
    select?: SystemSettingSelect<ExtArgs> | null
    /**
     * Filter, which SystemSetting to fetch.
     */
    where: SystemSettingWhereUniqueInput
  }

  /**
   * SystemSetting findUniqueOrThrow
   */
  export type SystemSettingFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SystemSetting
     */
    select?: SystemSettingSelect<ExtArgs> | null
    /**
     * Filter, which SystemSetting to fetch.
     */
    where: SystemSettingWhereUniqueInput
  }

  /**
   * SystemSetting findFirst
   */
  export type SystemSettingFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SystemSetting
     */
    select?: SystemSettingSelect<ExtArgs> | null
    /**
     * Filter, which SystemSetting to fetch.
     */
    where?: SystemSettingWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SystemSettings to fetch.
     */
    orderBy?: SystemSettingOrderByWithRelationInput | SystemSettingOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for SystemSettings.
     */
    cursor?: SystemSettingWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SystemSettings from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SystemSettings.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of SystemSettings.
     */
    distinct?: SystemSettingScalarFieldEnum | SystemSettingScalarFieldEnum[]
  }

  /**
   * SystemSetting findFirstOrThrow
   */
  export type SystemSettingFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SystemSetting
     */
    select?: SystemSettingSelect<ExtArgs> | null
    /**
     * Filter, which SystemSetting to fetch.
     */
    where?: SystemSettingWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SystemSettings to fetch.
     */
    orderBy?: SystemSettingOrderByWithRelationInput | SystemSettingOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for SystemSettings.
     */
    cursor?: SystemSettingWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SystemSettings from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SystemSettings.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of SystemSettings.
     */
    distinct?: SystemSettingScalarFieldEnum | SystemSettingScalarFieldEnum[]
  }

  /**
   * SystemSetting findMany
   */
  export type SystemSettingFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SystemSetting
     */
    select?: SystemSettingSelect<ExtArgs> | null
    /**
     * Filter, which SystemSettings to fetch.
     */
    where?: SystemSettingWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SystemSettings to fetch.
     */
    orderBy?: SystemSettingOrderByWithRelationInput | SystemSettingOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing SystemSettings.
     */
    cursor?: SystemSettingWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SystemSettings from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SystemSettings.
     */
    skip?: number
    distinct?: SystemSettingScalarFieldEnum | SystemSettingScalarFieldEnum[]
  }

  /**
   * SystemSetting create
   */
  export type SystemSettingCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SystemSetting
     */
    select?: SystemSettingSelect<ExtArgs> | null
    /**
     * The data needed to create a SystemSetting.
     */
    data: XOR<SystemSettingCreateInput, SystemSettingUncheckedCreateInput>
  }

  /**
   * SystemSetting createMany
   */
  export type SystemSettingCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many SystemSettings.
     */
    data: SystemSettingCreateManyInput | SystemSettingCreateManyInput[]
  }

  /**
   * SystemSetting createManyAndReturn
   */
  export type SystemSettingCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SystemSetting
     */
    select?: SystemSettingSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many SystemSettings.
     */
    data: SystemSettingCreateManyInput | SystemSettingCreateManyInput[]
  }

  /**
   * SystemSetting update
   */
  export type SystemSettingUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SystemSetting
     */
    select?: SystemSettingSelect<ExtArgs> | null
    /**
     * The data needed to update a SystemSetting.
     */
    data: XOR<SystemSettingUpdateInput, SystemSettingUncheckedUpdateInput>
    /**
     * Choose, which SystemSetting to update.
     */
    where: SystemSettingWhereUniqueInput
  }

  /**
   * SystemSetting updateMany
   */
  export type SystemSettingUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update SystemSettings.
     */
    data: XOR<SystemSettingUpdateManyMutationInput, SystemSettingUncheckedUpdateManyInput>
    /**
     * Filter which SystemSettings to update
     */
    where?: SystemSettingWhereInput
  }

  /**
   * SystemSetting upsert
   */
  export type SystemSettingUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SystemSetting
     */
    select?: SystemSettingSelect<ExtArgs> | null
    /**
     * The filter to search for the SystemSetting to update in case it exists.
     */
    where: SystemSettingWhereUniqueInput
    /**
     * In case the SystemSetting found by the `where` argument doesn't exist, create a new SystemSetting with this data.
     */
    create: XOR<SystemSettingCreateInput, SystemSettingUncheckedCreateInput>
    /**
     * In case the SystemSetting was found with the provided `where` argument, update it with this data.
     */
    update: XOR<SystemSettingUpdateInput, SystemSettingUncheckedUpdateInput>
  }

  /**
   * SystemSetting delete
   */
  export type SystemSettingDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SystemSetting
     */
    select?: SystemSettingSelect<ExtArgs> | null
    /**
     * Filter which SystemSetting to delete.
     */
    where: SystemSettingWhereUniqueInput
  }

  /**
   * SystemSetting deleteMany
   */
  export type SystemSettingDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which SystemSettings to delete
     */
    where?: SystemSettingWhereInput
  }

  /**
   * SystemSetting without action
   */
  export type SystemSettingDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SystemSetting
     */
    select?: SystemSettingSelect<ExtArgs> | null
  }


  /**
   * Model PriceRule
   */

  export type AggregatePriceRule = {
    _count: PriceRuleCountAggregateOutputType | null
    _avg: PriceRuleAvgAggregateOutputType | null
    _sum: PriceRuleSumAggregateOutputType | null
    _min: PriceRuleMinAggregateOutputType | null
    _max: PriceRuleMaxAggregateOutputType | null
  }

  export type PriceRuleAvgAggregateOutputType = {
    id: number | null
    minSize: number | null
    maxSize: number | null
    price: number | null
    refund: number | null
  }

  export type PriceRuleSumAggregateOutputType = {
    id: number | null
    minSize: number | null
    maxSize: number | null
    price: number | null
    refund: number | null
  }

  export type PriceRuleMinAggregateOutputType = {
    id: number | null
    description: string | null
    minSize: number | null
    maxSize: number | null
    price: number | null
    startDate: Date | null
    endDate: Date | null
    category: string | null
    refund: number | null
  }

  export type PriceRuleMaxAggregateOutputType = {
    id: number | null
    description: string | null
    minSize: number | null
    maxSize: number | null
    price: number | null
    startDate: Date | null
    endDate: Date | null
    category: string | null
    refund: number | null
  }

  export type PriceRuleCountAggregateOutputType = {
    id: number
    description: number
    minSize: number
    maxSize: number
    price: number
    startDate: number
    endDate: number
    category: number
    refund: number
    _all: number
  }


  export type PriceRuleAvgAggregateInputType = {
    id?: true
    minSize?: true
    maxSize?: true
    price?: true
    refund?: true
  }

  export type PriceRuleSumAggregateInputType = {
    id?: true
    minSize?: true
    maxSize?: true
    price?: true
    refund?: true
  }

  export type PriceRuleMinAggregateInputType = {
    id?: true
    description?: true
    minSize?: true
    maxSize?: true
    price?: true
    startDate?: true
    endDate?: true
    category?: true
    refund?: true
  }

  export type PriceRuleMaxAggregateInputType = {
    id?: true
    description?: true
    minSize?: true
    maxSize?: true
    price?: true
    startDate?: true
    endDate?: true
    category?: true
    refund?: true
  }

  export type PriceRuleCountAggregateInputType = {
    id?: true
    description?: true
    minSize?: true
    maxSize?: true
    price?: true
    startDate?: true
    endDate?: true
    category?: true
    refund?: true
    _all?: true
  }

  export type PriceRuleAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PriceRule to aggregate.
     */
    where?: PriceRuleWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PriceRules to fetch.
     */
    orderBy?: PriceRuleOrderByWithRelationInput | PriceRuleOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: PriceRuleWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PriceRules from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PriceRules.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned PriceRules
    **/
    _count?: true | PriceRuleCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: PriceRuleAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: PriceRuleSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: PriceRuleMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: PriceRuleMaxAggregateInputType
  }

  export type GetPriceRuleAggregateType<T extends PriceRuleAggregateArgs> = {
        [P in keyof T & keyof AggregatePriceRule]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregatePriceRule[P]>
      : GetScalarType<T[P], AggregatePriceRule[P]>
  }




  export type PriceRuleGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PriceRuleWhereInput
    orderBy?: PriceRuleOrderByWithAggregationInput | PriceRuleOrderByWithAggregationInput[]
    by: PriceRuleScalarFieldEnum[] | PriceRuleScalarFieldEnum
    having?: PriceRuleScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: PriceRuleCountAggregateInputType | true
    _avg?: PriceRuleAvgAggregateInputType
    _sum?: PriceRuleSumAggregateInputType
    _min?: PriceRuleMinAggregateInputType
    _max?: PriceRuleMaxAggregateInputType
  }

  export type PriceRuleGroupByOutputType = {
    id: number
    description: string | null
    minSize: number | null
    maxSize: number | null
    price: number | null
    startDate: Date | null
    endDate: Date | null
    category: string | null
    refund: number | null
    _count: PriceRuleCountAggregateOutputType | null
    _avg: PriceRuleAvgAggregateOutputType | null
    _sum: PriceRuleSumAggregateOutputType | null
    _min: PriceRuleMinAggregateOutputType | null
    _max: PriceRuleMaxAggregateOutputType | null
  }

  type GetPriceRuleGroupByPayload<T extends PriceRuleGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<PriceRuleGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof PriceRuleGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], PriceRuleGroupByOutputType[P]>
            : GetScalarType<T[P], PriceRuleGroupByOutputType[P]>
        }
      >
    >


  export type PriceRuleSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    description?: boolean
    minSize?: boolean
    maxSize?: boolean
    price?: boolean
    startDate?: boolean
    endDate?: boolean
    category?: boolean
    refund?: boolean
  }, ExtArgs["result"]["priceRule"]>

  export type PriceRuleSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    description?: boolean
    minSize?: boolean
    maxSize?: boolean
    price?: boolean
    startDate?: boolean
    endDate?: boolean
    category?: boolean
    refund?: boolean
  }, ExtArgs["result"]["priceRule"]>

  export type PriceRuleSelectScalar = {
    id?: boolean
    description?: boolean
    minSize?: boolean
    maxSize?: boolean
    price?: boolean
    startDate?: boolean
    endDate?: boolean
    category?: boolean
    refund?: boolean
  }


  export type $PriceRulePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "PriceRule"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: number
      description: string | null
      minSize: number | null
      maxSize: number | null
      price: number | null
      startDate: Date | null
      endDate: Date | null
      category: string | null
      refund: number | null
    }, ExtArgs["result"]["priceRule"]>
    composites: {}
  }

  type PriceRuleGetPayload<S extends boolean | null | undefined | PriceRuleDefaultArgs> = $Result.GetResult<Prisma.$PriceRulePayload, S>

  type PriceRuleCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<PriceRuleFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: PriceRuleCountAggregateInputType | true
    }

  export interface PriceRuleDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['PriceRule'], meta: { name: 'PriceRule' } }
    /**
     * Find zero or one PriceRule that matches the filter.
     * @param {PriceRuleFindUniqueArgs} args - Arguments to find a PriceRule
     * @example
     * // Get one PriceRule
     * const priceRule = await prisma.priceRule.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends PriceRuleFindUniqueArgs>(args: SelectSubset<T, PriceRuleFindUniqueArgs<ExtArgs>>): Prisma__PriceRuleClient<$Result.GetResult<Prisma.$PriceRulePayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one PriceRule that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {PriceRuleFindUniqueOrThrowArgs} args - Arguments to find a PriceRule
     * @example
     * // Get one PriceRule
     * const priceRule = await prisma.priceRule.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends PriceRuleFindUniqueOrThrowArgs>(args: SelectSubset<T, PriceRuleFindUniqueOrThrowArgs<ExtArgs>>): Prisma__PriceRuleClient<$Result.GetResult<Prisma.$PriceRulePayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first PriceRule that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PriceRuleFindFirstArgs} args - Arguments to find a PriceRule
     * @example
     * // Get one PriceRule
     * const priceRule = await prisma.priceRule.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends PriceRuleFindFirstArgs>(args?: SelectSubset<T, PriceRuleFindFirstArgs<ExtArgs>>): Prisma__PriceRuleClient<$Result.GetResult<Prisma.$PriceRulePayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first PriceRule that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PriceRuleFindFirstOrThrowArgs} args - Arguments to find a PriceRule
     * @example
     * // Get one PriceRule
     * const priceRule = await prisma.priceRule.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends PriceRuleFindFirstOrThrowArgs>(args?: SelectSubset<T, PriceRuleFindFirstOrThrowArgs<ExtArgs>>): Prisma__PriceRuleClient<$Result.GetResult<Prisma.$PriceRulePayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more PriceRules that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PriceRuleFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all PriceRules
     * const priceRules = await prisma.priceRule.findMany()
     * 
     * // Get first 10 PriceRules
     * const priceRules = await prisma.priceRule.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const priceRuleWithIdOnly = await prisma.priceRule.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends PriceRuleFindManyArgs>(args?: SelectSubset<T, PriceRuleFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PriceRulePayload<ExtArgs>, T, "findMany">>

    /**
     * Create a PriceRule.
     * @param {PriceRuleCreateArgs} args - Arguments to create a PriceRule.
     * @example
     * // Create one PriceRule
     * const PriceRule = await prisma.priceRule.create({
     *   data: {
     *     // ... data to create a PriceRule
     *   }
     * })
     * 
     */
    create<T extends PriceRuleCreateArgs>(args: SelectSubset<T, PriceRuleCreateArgs<ExtArgs>>): Prisma__PriceRuleClient<$Result.GetResult<Prisma.$PriceRulePayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many PriceRules.
     * @param {PriceRuleCreateManyArgs} args - Arguments to create many PriceRules.
     * @example
     * // Create many PriceRules
     * const priceRule = await prisma.priceRule.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends PriceRuleCreateManyArgs>(args?: SelectSubset<T, PriceRuleCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many PriceRules and returns the data saved in the database.
     * @param {PriceRuleCreateManyAndReturnArgs} args - Arguments to create many PriceRules.
     * @example
     * // Create many PriceRules
     * const priceRule = await prisma.priceRule.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many PriceRules and only return the `id`
     * const priceRuleWithIdOnly = await prisma.priceRule.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends PriceRuleCreateManyAndReturnArgs>(args?: SelectSubset<T, PriceRuleCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PriceRulePayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a PriceRule.
     * @param {PriceRuleDeleteArgs} args - Arguments to delete one PriceRule.
     * @example
     * // Delete one PriceRule
     * const PriceRule = await prisma.priceRule.delete({
     *   where: {
     *     // ... filter to delete one PriceRule
     *   }
     * })
     * 
     */
    delete<T extends PriceRuleDeleteArgs>(args: SelectSubset<T, PriceRuleDeleteArgs<ExtArgs>>): Prisma__PriceRuleClient<$Result.GetResult<Prisma.$PriceRulePayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one PriceRule.
     * @param {PriceRuleUpdateArgs} args - Arguments to update one PriceRule.
     * @example
     * // Update one PriceRule
     * const priceRule = await prisma.priceRule.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends PriceRuleUpdateArgs>(args: SelectSubset<T, PriceRuleUpdateArgs<ExtArgs>>): Prisma__PriceRuleClient<$Result.GetResult<Prisma.$PriceRulePayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more PriceRules.
     * @param {PriceRuleDeleteManyArgs} args - Arguments to filter PriceRules to delete.
     * @example
     * // Delete a few PriceRules
     * const { count } = await prisma.priceRule.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends PriceRuleDeleteManyArgs>(args?: SelectSubset<T, PriceRuleDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more PriceRules.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PriceRuleUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many PriceRules
     * const priceRule = await prisma.priceRule.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends PriceRuleUpdateManyArgs>(args: SelectSubset<T, PriceRuleUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one PriceRule.
     * @param {PriceRuleUpsertArgs} args - Arguments to update or create a PriceRule.
     * @example
     * // Update or create a PriceRule
     * const priceRule = await prisma.priceRule.upsert({
     *   create: {
     *     // ... data to create a PriceRule
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the PriceRule we want to update
     *   }
     * })
     */
    upsert<T extends PriceRuleUpsertArgs>(args: SelectSubset<T, PriceRuleUpsertArgs<ExtArgs>>): Prisma__PriceRuleClient<$Result.GetResult<Prisma.$PriceRulePayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of PriceRules.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PriceRuleCountArgs} args - Arguments to filter PriceRules to count.
     * @example
     * // Count the number of PriceRules
     * const count = await prisma.priceRule.count({
     *   where: {
     *     // ... the filter for the PriceRules we want to count
     *   }
     * })
    **/
    count<T extends PriceRuleCountArgs>(
      args?: Subset<T, PriceRuleCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], PriceRuleCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a PriceRule.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PriceRuleAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends PriceRuleAggregateArgs>(args: Subset<T, PriceRuleAggregateArgs>): Prisma.PrismaPromise<GetPriceRuleAggregateType<T>>

    /**
     * Group by PriceRule.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PriceRuleGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends PriceRuleGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: PriceRuleGroupByArgs['orderBy'] }
        : { orderBy?: PriceRuleGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, PriceRuleGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetPriceRuleGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the PriceRule model
   */
  readonly fields: PriceRuleFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for PriceRule.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__PriceRuleClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the PriceRule model
   */ 
  interface PriceRuleFieldRefs {
    readonly id: FieldRef<"PriceRule", 'Int'>
    readonly description: FieldRef<"PriceRule", 'String'>
    readonly minSize: FieldRef<"PriceRule", 'Int'>
    readonly maxSize: FieldRef<"PriceRule", 'Int'>
    readonly price: FieldRef<"PriceRule", 'Float'>
    readonly startDate: FieldRef<"PriceRule", 'DateTime'>
    readonly endDate: FieldRef<"PriceRule", 'DateTime'>
    readonly category: FieldRef<"PriceRule", 'String'>
    readonly refund: FieldRef<"PriceRule", 'Float'>
  }
    

  // Custom InputTypes
  /**
   * PriceRule findUnique
   */
  export type PriceRuleFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PriceRule
     */
    select?: PriceRuleSelect<ExtArgs> | null
    /**
     * Filter, which PriceRule to fetch.
     */
    where: PriceRuleWhereUniqueInput
  }

  /**
   * PriceRule findUniqueOrThrow
   */
  export type PriceRuleFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PriceRule
     */
    select?: PriceRuleSelect<ExtArgs> | null
    /**
     * Filter, which PriceRule to fetch.
     */
    where: PriceRuleWhereUniqueInput
  }

  /**
   * PriceRule findFirst
   */
  export type PriceRuleFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PriceRule
     */
    select?: PriceRuleSelect<ExtArgs> | null
    /**
     * Filter, which PriceRule to fetch.
     */
    where?: PriceRuleWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PriceRules to fetch.
     */
    orderBy?: PriceRuleOrderByWithRelationInput | PriceRuleOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PriceRules.
     */
    cursor?: PriceRuleWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PriceRules from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PriceRules.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PriceRules.
     */
    distinct?: PriceRuleScalarFieldEnum | PriceRuleScalarFieldEnum[]
  }

  /**
   * PriceRule findFirstOrThrow
   */
  export type PriceRuleFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PriceRule
     */
    select?: PriceRuleSelect<ExtArgs> | null
    /**
     * Filter, which PriceRule to fetch.
     */
    where?: PriceRuleWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PriceRules to fetch.
     */
    orderBy?: PriceRuleOrderByWithRelationInput | PriceRuleOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PriceRules.
     */
    cursor?: PriceRuleWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PriceRules from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PriceRules.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PriceRules.
     */
    distinct?: PriceRuleScalarFieldEnum | PriceRuleScalarFieldEnum[]
  }

  /**
   * PriceRule findMany
   */
  export type PriceRuleFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PriceRule
     */
    select?: PriceRuleSelect<ExtArgs> | null
    /**
     * Filter, which PriceRules to fetch.
     */
    where?: PriceRuleWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PriceRules to fetch.
     */
    orderBy?: PriceRuleOrderByWithRelationInput | PriceRuleOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing PriceRules.
     */
    cursor?: PriceRuleWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PriceRules from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PriceRules.
     */
    skip?: number
    distinct?: PriceRuleScalarFieldEnum | PriceRuleScalarFieldEnum[]
  }

  /**
   * PriceRule create
   */
  export type PriceRuleCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PriceRule
     */
    select?: PriceRuleSelect<ExtArgs> | null
    /**
     * The data needed to create a PriceRule.
     */
    data?: XOR<PriceRuleCreateInput, PriceRuleUncheckedCreateInput>
  }

  /**
   * PriceRule createMany
   */
  export type PriceRuleCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many PriceRules.
     */
    data: PriceRuleCreateManyInput | PriceRuleCreateManyInput[]
  }

  /**
   * PriceRule createManyAndReturn
   */
  export type PriceRuleCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PriceRule
     */
    select?: PriceRuleSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many PriceRules.
     */
    data: PriceRuleCreateManyInput | PriceRuleCreateManyInput[]
  }

  /**
   * PriceRule update
   */
  export type PriceRuleUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PriceRule
     */
    select?: PriceRuleSelect<ExtArgs> | null
    /**
     * The data needed to update a PriceRule.
     */
    data: XOR<PriceRuleUpdateInput, PriceRuleUncheckedUpdateInput>
    /**
     * Choose, which PriceRule to update.
     */
    where: PriceRuleWhereUniqueInput
  }

  /**
   * PriceRule updateMany
   */
  export type PriceRuleUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update PriceRules.
     */
    data: XOR<PriceRuleUpdateManyMutationInput, PriceRuleUncheckedUpdateManyInput>
    /**
     * Filter which PriceRules to update
     */
    where?: PriceRuleWhereInput
  }

  /**
   * PriceRule upsert
   */
  export type PriceRuleUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PriceRule
     */
    select?: PriceRuleSelect<ExtArgs> | null
    /**
     * The filter to search for the PriceRule to update in case it exists.
     */
    where: PriceRuleWhereUniqueInput
    /**
     * In case the PriceRule found by the `where` argument doesn't exist, create a new PriceRule with this data.
     */
    create: XOR<PriceRuleCreateInput, PriceRuleUncheckedCreateInput>
    /**
     * In case the PriceRule was found with the provided `where` argument, update it with this data.
     */
    update: XOR<PriceRuleUpdateInput, PriceRuleUncheckedUpdateInput>
  }

  /**
   * PriceRule delete
   */
  export type PriceRuleDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PriceRule
     */
    select?: PriceRuleSelect<ExtArgs> | null
    /**
     * Filter which PriceRule to delete.
     */
    where: PriceRuleWhereUniqueInput
  }

  /**
   * PriceRule deleteMany
   */
  export type PriceRuleDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PriceRules to delete
     */
    where?: PriceRuleWhereInput
  }

  /**
   * PriceRule without action
   */
  export type PriceRuleDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PriceRule
     */
    select?: PriceRuleSelect<ExtArgs> | null
  }


  /**
   * Model PageVisitLog
   */

  export type AggregatePageVisitLog = {
    _count: PageVisitLogCountAggregateOutputType | null
    _avg: PageVisitLogAvgAggregateOutputType | null
    _sum: PageVisitLogSumAggregateOutputType | null
    _min: PageVisitLogMinAggregateOutputType | null
    _max: PageVisitLogMaxAggregateOutputType | null
  }

  export type PageVisitLogAvgAggregateOutputType = {
    id: number | null
    employeeId: number | null
  }

  export type PageVisitLogSumAggregateOutputType = {
    id: number | null
    employeeId: number | null
  }

  export type PageVisitLogMinAggregateOutputType = {
    id: number | null
    pageUrl: string | null
    employeeId: number | null
    employeeName: string | null
    timestamp: Date | null
    loadingError: string | null
    isGuest: boolean | null
  }

  export type PageVisitLogMaxAggregateOutputType = {
    id: number | null
    pageUrl: string | null
    employeeId: number | null
    employeeName: string | null
    timestamp: Date | null
    loadingError: string | null
    isGuest: boolean | null
  }

  export type PageVisitLogCountAggregateOutputType = {
    id: number
    pageUrl: number
    employeeId: number
    employeeName: number
    timestamp: number
    loadingError: number
    isGuest: number
    _all: number
  }


  export type PageVisitLogAvgAggregateInputType = {
    id?: true
    employeeId?: true
  }

  export type PageVisitLogSumAggregateInputType = {
    id?: true
    employeeId?: true
  }

  export type PageVisitLogMinAggregateInputType = {
    id?: true
    pageUrl?: true
    employeeId?: true
    employeeName?: true
    timestamp?: true
    loadingError?: true
    isGuest?: true
  }

  export type PageVisitLogMaxAggregateInputType = {
    id?: true
    pageUrl?: true
    employeeId?: true
    employeeName?: true
    timestamp?: true
    loadingError?: true
    isGuest?: true
  }

  export type PageVisitLogCountAggregateInputType = {
    id?: true
    pageUrl?: true
    employeeId?: true
    employeeName?: true
    timestamp?: true
    loadingError?: true
    isGuest?: true
    _all?: true
  }

  export type PageVisitLogAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PageVisitLog to aggregate.
     */
    where?: PageVisitLogWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PageVisitLogs to fetch.
     */
    orderBy?: PageVisitLogOrderByWithRelationInput | PageVisitLogOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: PageVisitLogWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PageVisitLogs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PageVisitLogs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned PageVisitLogs
    **/
    _count?: true | PageVisitLogCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: PageVisitLogAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: PageVisitLogSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: PageVisitLogMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: PageVisitLogMaxAggregateInputType
  }

  export type GetPageVisitLogAggregateType<T extends PageVisitLogAggregateArgs> = {
        [P in keyof T & keyof AggregatePageVisitLog]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregatePageVisitLog[P]>
      : GetScalarType<T[P], AggregatePageVisitLog[P]>
  }




  export type PageVisitLogGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PageVisitLogWhereInput
    orderBy?: PageVisitLogOrderByWithAggregationInput | PageVisitLogOrderByWithAggregationInput[]
    by: PageVisitLogScalarFieldEnum[] | PageVisitLogScalarFieldEnum
    having?: PageVisitLogScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: PageVisitLogCountAggregateInputType | true
    _avg?: PageVisitLogAvgAggregateInputType
    _sum?: PageVisitLogSumAggregateInputType
    _min?: PageVisitLogMinAggregateInputType
    _max?: PageVisitLogMaxAggregateInputType
  }

  export type PageVisitLogGroupByOutputType = {
    id: number
    pageUrl: string
    employeeId: number | null
    employeeName: string | null
    timestamp: Date
    loadingError: string | null
    isGuest: boolean
    _count: PageVisitLogCountAggregateOutputType | null
    _avg: PageVisitLogAvgAggregateOutputType | null
    _sum: PageVisitLogSumAggregateOutputType | null
    _min: PageVisitLogMinAggregateOutputType | null
    _max: PageVisitLogMaxAggregateOutputType | null
  }

  type GetPageVisitLogGroupByPayload<T extends PageVisitLogGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<PageVisitLogGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof PageVisitLogGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], PageVisitLogGroupByOutputType[P]>
            : GetScalarType<T[P], PageVisitLogGroupByOutputType[P]>
        }
      >
    >


  export type PageVisitLogSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    pageUrl?: boolean
    employeeId?: boolean
    employeeName?: boolean
    timestamp?: boolean
    loadingError?: boolean
    isGuest?: boolean
    employee?: boolean | PageVisitLog$employeeArgs<ExtArgs>
  }, ExtArgs["result"]["pageVisitLog"]>

  export type PageVisitLogSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    pageUrl?: boolean
    employeeId?: boolean
    employeeName?: boolean
    timestamp?: boolean
    loadingError?: boolean
    isGuest?: boolean
    employee?: boolean | PageVisitLog$employeeArgs<ExtArgs>
  }, ExtArgs["result"]["pageVisitLog"]>

  export type PageVisitLogSelectScalar = {
    id?: boolean
    pageUrl?: boolean
    employeeId?: boolean
    employeeName?: boolean
    timestamp?: boolean
    loadingError?: boolean
    isGuest?: boolean
  }

  export type PageVisitLogInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    employee?: boolean | PageVisitLog$employeeArgs<ExtArgs>
  }
  export type PageVisitLogIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    employee?: boolean | PageVisitLog$employeeArgs<ExtArgs>
  }

  export type $PageVisitLogPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "PageVisitLog"
    objects: {
      employee: Prisma.$EmployeePayload<ExtArgs> | null
    }
    scalars: $Extensions.GetPayloadResult<{
      id: number
      pageUrl: string
      employeeId: number | null
      employeeName: string | null
      timestamp: Date
      loadingError: string | null
      isGuest: boolean
    }, ExtArgs["result"]["pageVisitLog"]>
    composites: {}
  }

  type PageVisitLogGetPayload<S extends boolean | null | undefined | PageVisitLogDefaultArgs> = $Result.GetResult<Prisma.$PageVisitLogPayload, S>

  type PageVisitLogCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<PageVisitLogFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: PageVisitLogCountAggregateInputType | true
    }

  export interface PageVisitLogDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['PageVisitLog'], meta: { name: 'PageVisitLog' } }
    /**
     * Find zero or one PageVisitLog that matches the filter.
     * @param {PageVisitLogFindUniqueArgs} args - Arguments to find a PageVisitLog
     * @example
     * // Get one PageVisitLog
     * const pageVisitLog = await prisma.pageVisitLog.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends PageVisitLogFindUniqueArgs>(args: SelectSubset<T, PageVisitLogFindUniqueArgs<ExtArgs>>): Prisma__PageVisitLogClient<$Result.GetResult<Prisma.$PageVisitLogPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one PageVisitLog that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {PageVisitLogFindUniqueOrThrowArgs} args - Arguments to find a PageVisitLog
     * @example
     * // Get one PageVisitLog
     * const pageVisitLog = await prisma.pageVisitLog.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends PageVisitLogFindUniqueOrThrowArgs>(args: SelectSubset<T, PageVisitLogFindUniqueOrThrowArgs<ExtArgs>>): Prisma__PageVisitLogClient<$Result.GetResult<Prisma.$PageVisitLogPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first PageVisitLog that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PageVisitLogFindFirstArgs} args - Arguments to find a PageVisitLog
     * @example
     * // Get one PageVisitLog
     * const pageVisitLog = await prisma.pageVisitLog.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends PageVisitLogFindFirstArgs>(args?: SelectSubset<T, PageVisitLogFindFirstArgs<ExtArgs>>): Prisma__PageVisitLogClient<$Result.GetResult<Prisma.$PageVisitLogPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first PageVisitLog that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PageVisitLogFindFirstOrThrowArgs} args - Arguments to find a PageVisitLog
     * @example
     * // Get one PageVisitLog
     * const pageVisitLog = await prisma.pageVisitLog.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends PageVisitLogFindFirstOrThrowArgs>(args?: SelectSubset<T, PageVisitLogFindFirstOrThrowArgs<ExtArgs>>): Prisma__PageVisitLogClient<$Result.GetResult<Prisma.$PageVisitLogPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more PageVisitLogs that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PageVisitLogFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all PageVisitLogs
     * const pageVisitLogs = await prisma.pageVisitLog.findMany()
     * 
     * // Get first 10 PageVisitLogs
     * const pageVisitLogs = await prisma.pageVisitLog.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const pageVisitLogWithIdOnly = await prisma.pageVisitLog.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends PageVisitLogFindManyArgs>(args?: SelectSubset<T, PageVisitLogFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PageVisitLogPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a PageVisitLog.
     * @param {PageVisitLogCreateArgs} args - Arguments to create a PageVisitLog.
     * @example
     * // Create one PageVisitLog
     * const PageVisitLog = await prisma.pageVisitLog.create({
     *   data: {
     *     // ... data to create a PageVisitLog
     *   }
     * })
     * 
     */
    create<T extends PageVisitLogCreateArgs>(args: SelectSubset<T, PageVisitLogCreateArgs<ExtArgs>>): Prisma__PageVisitLogClient<$Result.GetResult<Prisma.$PageVisitLogPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many PageVisitLogs.
     * @param {PageVisitLogCreateManyArgs} args - Arguments to create many PageVisitLogs.
     * @example
     * // Create many PageVisitLogs
     * const pageVisitLog = await prisma.pageVisitLog.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends PageVisitLogCreateManyArgs>(args?: SelectSubset<T, PageVisitLogCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many PageVisitLogs and returns the data saved in the database.
     * @param {PageVisitLogCreateManyAndReturnArgs} args - Arguments to create many PageVisitLogs.
     * @example
     * // Create many PageVisitLogs
     * const pageVisitLog = await prisma.pageVisitLog.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many PageVisitLogs and only return the `id`
     * const pageVisitLogWithIdOnly = await prisma.pageVisitLog.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends PageVisitLogCreateManyAndReturnArgs>(args?: SelectSubset<T, PageVisitLogCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PageVisitLogPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a PageVisitLog.
     * @param {PageVisitLogDeleteArgs} args - Arguments to delete one PageVisitLog.
     * @example
     * // Delete one PageVisitLog
     * const PageVisitLog = await prisma.pageVisitLog.delete({
     *   where: {
     *     // ... filter to delete one PageVisitLog
     *   }
     * })
     * 
     */
    delete<T extends PageVisitLogDeleteArgs>(args: SelectSubset<T, PageVisitLogDeleteArgs<ExtArgs>>): Prisma__PageVisitLogClient<$Result.GetResult<Prisma.$PageVisitLogPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one PageVisitLog.
     * @param {PageVisitLogUpdateArgs} args - Arguments to update one PageVisitLog.
     * @example
     * // Update one PageVisitLog
     * const pageVisitLog = await prisma.pageVisitLog.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends PageVisitLogUpdateArgs>(args: SelectSubset<T, PageVisitLogUpdateArgs<ExtArgs>>): Prisma__PageVisitLogClient<$Result.GetResult<Prisma.$PageVisitLogPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more PageVisitLogs.
     * @param {PageVisitLogDeleteManyArgs} args - Arguments to filter PageVisitLogs to delete.
     * @example
     * // Delete a few PageVisitLogs
     * const { count } = await prisma.pageVisitLog.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends PageVisitLogDeleteManyArgs>(args?: SelectSubset<T, PageVisitLogDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more PageVisitLogs.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PageVisitLogUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many PageVisitLogs
     * const pageVisitLog = await prisma.pageVisitLog.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends PageVisitLogUpdateManyArgs>(args: SelectSubset<T, PageVisitLogUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one PageVisitLog.
     * @param {PageVisitLogUpsertArgs} args - Arguments to update or create a PageVisitLog.
     * @example
     * // Update or create a PageVisitLog
     * const pageVisitLog = await prisma.pageVisitLog.upsert({
     *   create: {
     *     // ... data to create a PageVisitLog
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the PageVisitLog we want to update
     *   }
     * })
     */
    upsert<T extends PageVisitLogUpsertArgs>(args: SelectSubset<T, PageVisitLogUpsertArgs<ExtArgs>>): Prisma__PageVisitLogClient<$Result.GetResult<Prisma.$PageVisitLogPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of PageVisitLogs.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PageVisitLogCountArgs} args - Arguments to filter PageVisitLogs to count.
     * @example
     * // Count the number of PageVisitLogs
     * const count = await prisma.pageVisitLog.count({
     *   where: {
     *     // ... the filter for the PageVisitLogs we want to count
     *   }
     * })
    **/
    count<T extends PageVisitLogCountArgs>(
      args?: Subset<T, PageVisitLogCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], PageVisitLogCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a PageVisitLog.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PageVisitLogAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends PageVisitLogAggregateArgs>(args: Subset<T, PageVisitLogAggregateArgs>): Prisma.PrismaPromise<GetPageVisitLogAggregateType<T>>

    /**
     * Group by PageVisitLog.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PageVisitLogGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends PageVisitLogGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: PageVisitLogGroupByArgs['orderBy'] }
        : { orderBy?: PageVisitLogGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, PageVisitLogGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetPageVisitLogGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the PageVisitLog model
   */
  readonly fields: PageVisitLogFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for PageVisitLog.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__PageVisitLogClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    employee<T extends PageVisitLog$employeeArgs<ExtArgs> = {}>(args?: Subset<T, PageVisitLog$employeeArgs<ExtArgs>>): Prisma__EmployeeClient<$Result.GetResult<Prisma.$EmployeePayload<ExtArgs>, T, "findUniqueOrThrow"> | null, null, ExtArgs>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the PageVisitLog model
   */ 
  interface PageVisitLogFieldRefs {
    readonly id: FieldRef<"PageVisitLog", 'Int'>
    readonly pageUrl: FieldRef<"PageVisitLog", 'String'>
    readonly employeeId: FieldRef<"PageVisitLog", 'Int'>
    readonly employeeName: FieldRef<"PageVisitLog", 'String'>
    readonly timestamp: FieldRef<"PageVisitLog", 'DateTime'>
    readonly loadingError: FieldRef<"PageVisitLog", 'String'>
    readonly isGuest: FieldRef<"PageVisitLog", 'Boolean'>
  }
    

  // Custom InputTypes
  /**
   * PageVisitLog findUnique
   */
  export type PageVisitLogFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PageVisitLog
     */
    select?: PageVisitLogSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PageVisitLogInclude<ExtArgs> | null
    /**
     * Filter, which PageVisitLog to fetch.
     */
    where: PageVisitLogWhereUniqueInput
  }

  /**
   * PageVisitLog findUniqueOrThrow
   */
  export type PageVisitLogFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PageVisitLog
     */
    select?: PageVisitLogSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PageVisitLogInclude<ExtArgs> | null
    /**
     * Filter, which PageVisitLog to fetch.
     */
    where: PageVisitLogWhereUniqueInput
  }

  /**
   * PageVisitLog findFirst
   */
  export type PageVisitLogFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PageVisitLog
     */
    select?: PageVisitLogSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PageVisitLogInclude<ExtArgs> | null
    /**
     * Filter, which PageVisitLog to fetch.
     */
    where?: PageVisitLogWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PageVisitLogs to fetch.
     */
    orderBy?: PageVisitLogOrderByWithRelationInput | PageVisitLogOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PageVisitLogs.
     */
    cursor?: PageVisitLogWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PageVisitLogs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PageVisitLogs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PageVisitLogs.
     */
    distinct?: PageVisitLogScalarFieldEnum | PageVisitLogScalarFieldEnum[]
  }

  /**
   * PageVisitLog findFirstOrThrow
   */
  export type PageVisitLogFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PageVisitLog
     */
    select?: PageVisitLogSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PageVisitLogInclude<ExtArgs> | null
    /**
     * Filter, which PageVisitLog to fetch.
     */
    where?: PageVisitLogWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PageVisitLogs to fetch.
     */
    orderBy?: PageVisitLogOrderByWithRelationInput | PageVisitLogOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PageVisitLogs.
     */
    cursor?: PageVisitLogWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PageVisitLogs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PageVisitLogs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PageVisitLogs.
     */
    distinct?: PageVisitLogScalarFieldEnum | PageVisitLogScalarFieldEnum[]
  }

  /**
   * PageVisitLog findMany
   */
  export type PageVisitLogFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PageVisitLog
     */
    select?: PageVisitLogSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PageVisitLogInclude<ExtArgs> | null
    /**
     * Filter, which PageVisitLogs to fetch.
     */
    where?: PageVisitLogWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PageVisitLogs to fetch.
     */
    orderBy?: PageVisitLogOrderByWithRelationInput | PageVisitLogOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing PageVisitLogs.
     */
    cursor?: PageVisitLogWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PageVisitLogs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PageVisitLogs.
     */
    skip?: number
    distinct?: PageVisitLogScalarFieldEnum | PageVisitLogScalarFieldEnum[]
  }

  /**
   * PageVisitLog create
   */
  export type PageVisitLogCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PageVisitLog
     */
    select?: PageVisitLogSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PageVisitLogInclude<ExtArgs> | null
    /**
     * The data needed to create a PageVisitLog.
     */
    data: XOR<PageVisitLogCreateInput, PageVisitLogUncheckedCreateInput>
  }

  /**
   * PageVisitLog createMany
   */
  export type PageVisitLogCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many PageVisitLogs.
     */
    data: PageVisitLogCreateManyInput | PageVisitLogCreateManyInput[]
  }

  /**
   * PageVisitLog createManyAndReturn
   */
  export type PageVisitLogCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PageVisitLog
     */
    select?: PageVisitLogSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many PageVisitLogs.
     */
    data: PageVisitLogCreateManyInput | PageVisitLogCreateManyInput[]
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PageVisitLogIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * PageVisitLog update
   */
  export type PageVisitLogUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PageVisitLog
     */
    select?: PageVisitLogSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PageVisitLogInclude<ExtArgs> | null
    /**
     * The data needed to update a PageVisitLog.
     */
    data: XOR<PageVisitLogUpdateInput, PageVisitLogUncheckedUpdateInput>
    /**
     * Choose, which PageVisitLog to update.
     */
    where: PageVisitLogWhereUniqueInput
  }

  /**
   * PageVisitLog updateMany
   */
  export type PageVisitLogUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update PageVisitLogs.
     */
    data: XOR<PageVisitLogUpdateManyMutationInput, PageVisitLogUncheckedUpdateManyInput>
    /**
     * Filter which PageVisitLogs to update
     */
    where?: PageVisitLogWhereInput
  }

  /**
   * PageVisitLog upsert
   */
  export type PageVisitLogUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PageVisitLog
     */
    select?: PageVisitLogSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PageVisitLogInclude<ExtArgs> | null
    /**
     * The filter to search for the PageVisitLog to update in case it exists.
     */
    where: PageVisitLogWhereUniqueInput
    /**
     * In case the PageVisitLog found by the `where` argument doesn't exist, create a new PageVisitLog with this data.
     */
    create: XOR<PageVisitLogCreateInput, PageVisitLogUncheckedCreateInput>
    /**
     * In case the PageVisitLog was found with the provided `where` argument, update it with this data.
     */
    update: XOR<PageVisitLogUpdateInput, PageVisitLogUncheckedUpdateInput>
  }

  /**
   * PageVisitLog delete
   */
  export type PageVisitLogDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PageVisitLog
     */
    select?: PageVisitLogSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PageVisitLogInclude<ExtArgs> | null
    /**
     * Filter which PageVisitLog to delete.
     */
    where: PageVisitLogWhereUniqueInput
  }

  /**
   * PageVisitLog deleteMany
   */
  export type PageVisitLogDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PageVisitLogs to delete
     */
    where?: PageVisitLogWhereInput
  }

  /**
   * PageVisitLog.employee
   */
  export type PageVisitLog$employeeArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Employee
     */
    select?: EmployeeSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EmployeeInclude<ExtArgs> | null
    where?: EmployeeWhereInput
  }

  /**
   * PageVisitLog without action
   */
  export type PageVisitLogDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PageVisitLog
     */
    select?: PageVisitLogSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PageVisitLogInclude<ExtArgs> | null
  }


  /**
   * Model EmailLog
   */

  export type AggregateEmailLog = {
    _count: EmailLogCountAggregateOutputType | null
    _avg: EmailLogAvgAggregateOutputType | null
    _sum: EmailLogSumAggregateOutputType | null
    _min: EmailLogMinAggregateOutputType | null
    _max: EmailLogMaxAggregateOutputType | null
  }

  export type EmailLogAvgAggregateOutputType = {
    id: number | null
    customerId: number | null
    employeeId: number | null
  }

  export type EmailLogSumAggregateOutputType = {
    id: number | null
    customerId: number | null
    employeeId: number | null
  }

  export type EmailLogMinAggregateOutputType = {
    id: number | null
    to: string | null
    cc: string | null
    subject: string | null
    body: string | null
    fileName: string | null
    status: string | null
    errorMessage: string | null
    customerId: number | null
    employeeId: number | null
    sentAt: Date | null
  }

  export type EmailLogMaxAggregateOutputType = {
    id: number | null
    to: string | null
    cc: string | null
    subject: string | null
    body: string | null
    fileName: string | null
    status: string | null
    errorMessage: string | null
    customerId: number | null
    employeeId: number | null
    sentAt: Date | null
  }

  export type EmailLogCountAggregateOutputType = {
    id: number
    to: number
    cc: number
    subject: number
    body: number
    fileName: number
    status: number
    errorMessage: number
    customerId: number
    employeeId: number
    sentAt: number
    _all: number
  }


  export type EmailLogAvgAggregateInputType = {
    id?: true
    customerId?: true
    employeeId?: true
  }

  export type EmailLogSumAggregateInputType = {
    id?: true
    customerId?: true
    employeeId?: true
  }

  export type EmailLogMinAggregateInputType = {
    id?: true
    to?: true
    cc?: true
    subject?: true
    body?: true
    fileName?: true
    status?: true
    errorMessage?: true
    customerId?: true
    employeeId?: true
    sentAt?: true
  }

  export type EmailLogMaxAggregateInputType = {
    id?: true
    to?: true
    cc?: true
    subject?: true
    body?: true
    fileName?: true
    status?: true
    errorMessage?: true
    customerId?: true
    employeeId?: true
    sentAt?: true
  }

  export type EmailLogCountAggregateInputType = {
    id?: true
    to?: true
    cc?: true
    subject?: true
    body?: true
    fileName?: true
    status?: true
    errorMessage?: true
    customerId?: true
    employeeId?: true
    sentAt?: true
    _all?: true
  }

  export type EmailLogAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which EmailLog to aggregate.
     */
    where?: EmailLogWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of EmailLogs to fetch.
     */
    orderBy?: EmailLogOrderByWithRelationInput | EmailLogOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: EmailLogWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` EmailLogs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` EmailLogs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned EmailLogs
    **/
    _count?: true | EmailLogCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: EmailLogAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: EmailLogSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: EmailLogMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: EmailLogMaxAggregateInputType
  }

  export type GetEmailLogAggregateType<T extends EmailLogAggregateArgs> = {
        [P in keyof T & keyof AggregateEmailLog]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateEmailLog[P]>
      : GetScalarType<T[P], AggregateEmailLog[P]>
  }




  export type EmailLogGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: EmailLogWhereInput
    orderBy?: EmailLogOrderByWithAggregationInput | EmailLogOrderByWithAggregationInput[]
    by: EmailLogScalarFieldEnum[] | EmailLogScalarFieldEnum
    having?: EmailLogScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: EmailLogCountAggregateInputType | true
    _avg?: EmailLogAvgAggregateInputType
    _sum?: EmailLogSumAggregateInputType
    _min?: EmailLogMinAggregateInputType
    _max?: EmailLogMaxAggregateInputType
  }

  export type EmailLogGroupByOutputType = {
    id: number
    to: string
    cc: string | null
    subject: string | null
    body: string | null
    fileName: string | null
    status: string
    errorMessage: string | null
    customerId: number | null
    employeeId: number | null
    sentAt: Date
    _count: EmailLogCountAggregateOutputType | null
    _avg: EmailLogAvgAggregateOutputType | null
    _sum: EmailLogSumAggregateOutputType | null
    _min: EmailLogMinAggregateOutputType | null
    _max: EmailLogMaxAggregateOutputType | null
  }

  type GetEmailLogGroupByPayload<T extends EmailLogGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<EmailLogGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof EmailLogGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], EmailLogGroupByOutputType[P]>
            : GetScalarType<T[P], EmailLogGroupByOutputType[P]>
        }
      >
    >


  export type EmailLogSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    to?: boolean
    cc?: boolean
    subject?: boolean
    body?: boolean
    fileName?: boolean
    status?: boolean
    errorMessage?: boolean
    customerId?: boolean
    employeeId?: boolean
    sentAt?: boolean
  }, ExtArgs["result"]["emailLog"]>

  export type EmailLogSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    to?: boolean
    cc?: boolean
    subject?: boolean
    body?: boolean
    fileName?: boolean
    status?: boolean
    errorMessage?: boolean
    customerId?: boolean
    employeeId?: boolean
    sentAt?: boolean
  }, ExtArgs["result"]["emailLog"]>

  export type EmailLogSelectScalar = {
    id?: boolean
    to?: boolean
    cc?: boolean
    subject?: boolean
    body?: boolean
    fileName?: boolean
    status?: boolean
    errorMessage?: boolean
    customerId?: boolean
    employeeId?: boolean
    sentAt?: boolean
  }


  export type $EmailLogPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "EmailLog"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: number
      to: string
      cc: string | null
      subject: string | null
      body: string | null
      fileName: string | null
      status: string
      errorMessage: string | null
      customerId: number | null
      employeeId: number | null
      sentAt: Date
    }, ExtArgs["result"]["emailLog"]>
    composites: {}
  }

  type EmailLogGetPayload<S extends boolean | null | undefined | EmailLogDefaultArgs> = $Result.GetResult<Prisma.$EmailLogPayload, S>

  type EmailLogCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<EmailLogFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: EmailLogCountAggregateInputType | true
    }

  export interface EmailLogDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['EmailLog'], meta: { name: 'EmailLog' } }
    /**
     * Find zero or one EmailLog that matches the filter.
     * @param {EmailLogFindUniqueArgs} args - Arguments to find a EmailLog
     * @example
     * // Get one EmailLog
     * const emailLog = await prisma.emailLog.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends EmailLogFindUniqueArgs>(args: SelectSubset<T, EmailLogFindUniqueArgs<ExtArgs>>): Prisma__EmailLogClient<$Result.GetResult<Prisma.$EmailLogPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one EmailLog that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {EmailLogFindUniqueOrThrowArgs} args - Arguments to find a EmailLog
     * @example
     * // Get one EmailLog
     * const emailLog = await prisma.emailLog.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends EmailLogFindUniqueOrThrowArgs>(args: SelectSubset<T, EmailLogFindUniqueOrThrowArgs<ExtArgs>>): Prisma__EmailLogClient<$Result.GetResult<Prisma.$EmailLogPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first EmailLog that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EmailLogFindFirstArgs} args - Arguments to find a EmailLog
     * @example
     * // Get one EmailLog
     * const emailLog = await prisma.emailLog.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends EmailLogFindFirstArgs>(args?: SelectSubset<T, EmailLogFindFirstArgs<ExtArgs>>): Prisma__EmailLogClient<$Result.GetResult<Prisma.$EmailLogPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first EmailLog that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EmailLogFindFirstOrThrowArgs} args - Arguments to find a EmailLog
     * @example
     * // Get one EmailLog
     * const emailLog = await prisma.emailLog.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends EmailLogFindFirstOrThrowArgs>(args?: SelectSubset<T, EmailLogFindFirstOrThrowArgs<ExtArgs>>): Prisma__EmailLogClient<$Result.GetResult<Prisma.$EmailLogPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more EmailLogs that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EmailLogFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all EmailLogs
     * const emailLogs = await prisma.emailLog.findMany()
     * 
     * // Get first 10 EmailLogs
     * const emailLogs = await prisma.emailLog.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const emailLogWithIdOnly = await prisma.emailLog.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends EmailLogFindManyArgs>(args?: SelectSubset<T, EmailLogFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$EmailLogPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a EmailLog.
     * @param {EmailLogCreateArgs} args - Arguments to create a EmailLog.
     * @example
     * // Create one EmailLog
     * const EmailLog = await prisma.emailLog.create({
     *   data: {
     *     // ... data to create a EmailLog
     *   }
     * })
     * 
     */
    create<T extends EmailLogCreateArgs>(args: SelectSubset<T, EmailLogCreateArgs<ExtArgs>>): Prisma__EmailLogClient<$Result.GetResult<Prisma.$EmailLogPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many EmailLogs.
     * @param {EmailLogCreateManyArgs} args - Arguments to create many EmailLogs.
     * @example
     * // Create many EmailLogs
     * const emailLog = await prisma.emailLog.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends EmailLogCreateManyArgs>(args?: SelectSubset<T, EmailLogCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many EmailLogs and returns the data saved in the database.
     * @param {EmailLogCreateManyAndReturnArgs} args - Arguments to create many EmailLogs.
     * @example
     * // Create many EmailLogs
     * const emailLog = await prisma.emailLog.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many EmailLogs and only return the `id`
     * const emailLogWithIdOnly = await prisma.emailLog.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends EmailLogCreateManyAndReturnArgs>(args?: SelectSubset<T, EmailLogCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$EmailLogPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a EmailLog.
     * @param {EmailLogDeleteArgs} args - Arguments to delete one EmailLog.
     * @example
     * // Delete one EmailLog
     * const EmailLog = await prisma.emailLog.delete({
     *   where: {
     *     // ... filter to delete one EmailLog
     *   }
     * })
     * 
     */
    delete<T extends EmailLogDeleteArgs>(args: SelectSubset<T, EmailLogDeleteArgs<ExtArgs>>): Prisma__EmailLogClient<$Result.GetResult<Prisma.$EmailLogPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one EmailLog.
     * @param {EmailLogUpdateArgs} args - Arguments to update one EmailLog.
     * @example
     * // Update one EmailLog
     * const emailLog = await prisma.emailLog.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends EmailLogUpdateArgs>(args: SelectSubset<T, EmailLogUpdateArgs<ExtArgs>>): Prisma__EmailLogClient<$Result.GetResult<Prisma.$EmailLogPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more EmailLogs.
     * @param {EmailLogDeleteManyArgs} args - Arguments to filter EmailLogs to delete.
     * @example
     * // Delete a few EmailLogs
     * const { count } = await prisma.emailLog.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends EmailLogDeleteManyArgs>(args?: SelectSubset<T, EmailLogDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more EmailLogs.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EmailLogUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many EmailLogs
     * const emailLog = await prisma.emailLog.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends EmailLogUpdateManyArgs>(args: SelectSubset<T, EmailLogUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one EmailLog.
     * @param {EmailLogUpsertArgs} args - Arguments to update or create a EmailLog.
     * @example
     * // Update or create a EmailLog
     * const emailLog = await prisma.emailLog.upsert({
     *   create: {
     *     // ... data to create a EmailLog
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the EmailLog we want to update
     *   }
     * })
     */
    upsert<T extends EmailLogUpsertArgs>(args: SelectSubset<T, EmailLogUpsertArgs<ExtArgs>>): Prisma__EmailLogClient<$Result.GetResult<Prisma.$EmailLogPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of EmailLogs.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EmailLogCountArgs} args - Arguments to filter EmailLogs to count.
     * @example
     * // Count the number of EmailLogs
     * const count = await prisma.emailLog.count({
     *   where: {
     *     // ... the filter for the EmailLogs we want to count
     *   }
     * })
    **/
    count<T extends EmailLogCountArgs>(
      args?: Subset<T, EmailLogCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], EmailLogCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a EmailLog.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EmailLogAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends EmailLogAggregateArgs>(args: Subset<T, EmailLogAggregateArgs>): Prisma.PrismaPromise<GetEmailLogAggregateType<T>>

    /**
     * Group by EmailLog.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EmailLogGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends EmailLogGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: EmailLogGroupByArgs['orderBy'] }
        : { orderBy?: EmailLogGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, EmailLogGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetEmailLogGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the EmailLog model
   */
  readonly fields: EmailLogFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for EmailLog.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__EmailLogClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the EmailLog model
   */ 
  interface EmailLogFieldRefs {
    readonly id: FieldRef<"EmailLog", 'Int'>
    readonly to: FieldRef<"EmailLog", 'String'>
    readonly cc: FieldRef<"EmailLog", 'String'>
    readonly subject: FieldRef<"EmailLog", 'String'>
    readonly body: FieldRef<"EmailLog", 'String'>
    readonly fileName: FieldRef<"EmailLog", 'String'>
    readonly status: FieldRef<"EmailLog", 'String'>
    readonly errorMessage: FieldRef<"EmailLog", 'String'>
    readonly customerId: FieldRef<"EmailLog", 'Int'>
    readonly employeeId: FieldRef<"EmailLog", 'Int'>
    readonly sentAt: FieldRef<"EmailLog", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * EmailLog findUnique
   */
  export type EmailLogFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EmailLog
     */
    select?: EmailLogSelect<ExtArgs> | null
    /**
     * Filter, which EmailLog to fetch.
     */
    where: EmailLogWhereUniqueInput
  }

  /**
   * EmailLog findUniqueOrThrow
   */
  export type EmailLogFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EmailLog
     */
    select?: EmailLogSelect<ExtArgs> | null
    /**
     * Filter, which EmailLog to fetch.
     */
    where: EmailLogWhereUniqueInput
  }

  /**
   * EmailLog findFirst
   */
  export type EmailLogFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EmailLog
     */
    select?: EmailLogSelect<ExtArgs> | null
    /**
     * Filter, which EmailLog to fetch.
     */
    where?: EmailLogWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of EmailLogs to fetch.
     */
    orderBy?: EmailLogOrderByWithRelationInput | EmailLogOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for EmailLogs.
     */
    cursor?: EmailLogWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` EmailLogs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` EmailLogs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of EmailLogs.
     */
    distinct?: EmailLogScalarFieldEnum | EmailLogScalarFieldEnum[]
  }

  /**
   * EmailLog findFirstOrThrow
   */
  export type EmailLogFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EmailLog
     */
    select?: EmailLogSelect<ExtArgs> | null
    /**
     * Filter, which EmailLog to fetch.
     */
    where?: EmailLogWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of EmailLogs to fetch.
     */
    orderBy?: EmailLogOrderByWithRelationInput | EmailLogOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for EmailLogs.
     */
    cursor?: EmailLogWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` EmailLogs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` EmailLogs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of EmailLogs.
     */
    distinct?: EmailLogScalarFieldEnum | EmailLogScalarFieldEnum[]
  }

  /**
   * EmailLog findMany
   */
  export type EmailLogFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EmailLog
     */
    select?: EmailLogSelect<ExtArgs> | null
    /**
     * Filter, which EmailLogs to fetch.
     */
    where?: EmailLogWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of EmailLogs to fetch.
     */
    orderBy?: EmailLogOrderByWithRelationInput | EmailLogOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing EmailLogs.
     */
    cursor?: EmailLogWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` EmailLogs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` EmailLogs.
     */
    skip?: number
    distinct?: EmailLogScalarFieldEnum | EmailLogScalarFieldEnum[]
  }

  /**
   * EmailLog create
   */
  export type EmailLogCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EmailLog
     */
    select?: EmailLogSelect<ExtArgs> | null
    /**
     * The data needed to create a EmailLog.
     */
    data: XOR<EmailLogCreateInput, EmailLogUncheckedCreateInput>
  }

  /**
   * EmailLog createMany
   */
  export type EmailLogCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many EmailLogs.
     */
    data: EmailLogCreateManyInput | EmailLogCreateManyInput[]
  }

  /**
   * EmailLog createManyAndReturn
   */
  export type EmailLogCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EmailLog
     */
    select?: EmailLogSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many EmailLogs.
     */
    data: EmailLogCreateManyInput | EmailLogCreateManyInput[]
  }

  /**
   * EmailLog update
   */
  export type EmailLogUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EmailLog
     */
    select?: EmailLogSelect<ExtArgs> | null
    /**
     * The data needed to update a EmailLog.
     */
    data: XOR<EmailLogUpdateInput, EmailLogUncheckedUpdateInput>
    /**
     * Choose, which EmailLog to update.
     */
    where: EmailLogWhereUniqueInput
  }

  /**
   * EmailLog updateMany
   */
  export type EmailLogUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update EmailLogs.
     */
    data: XOR<EmailLogUpdateManyMutationInput, EmailLogUncheckedUpdateManyInput>
    /**
     * Filter which EmailLogs to update
     */
    where?: EmailLogWhereInput
  }

  /**
   * EmailLog upsert
   */
  export type EmailLogUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EmailLog
     */
    select?: EmailLogSelect<ExtArgs> | null
    /**
     * The filter to search for the EmailLog to update in case it exists.
     */
    where: EmailLogWhereUniqueInput
    /**
     * In case the EmailLog found by the `where` argument doesn't exist, create a new EmailLog with this data.
     */
    create: XOR<EmailLogCreateInput, EmailLogUncheckedCreateInput>
    /**
     * In case the EmailLog was found with the provided `where` argument, update it with this data.
     */
    update: XOR<EmailLogUpdateInput, EmailLogUncheckedUpdateInput>
  }

  /**
   * EmailLog delete
   */
  export type EmailLogDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EmailLog
     */
    select?: EmailLogSelect<ExtArgs> | null
    /**
     * Filter which EmailLog to delete.
     */
    where: EmailLogWhereUniqueInput
  }

  /**
   * EmailLog deleteMany
   */
  export type EmailLogDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which EmailLogs to delete
     */
    where?: EmailLogWhereInput
  }

  /**
   * EmailLog without action
   */
  export type EmailLogDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EmailLog
     */
    select?: EmailLogSelect<ExtArgs> | null
  }


  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    Serializable: 'Serializable'
  };

  export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel]


  export const CustomerScalarFieldEnum: {
    id: 'id',
    firstName: 'firstName',
    lastName: 'lastName',
    phone1: 'phone1',
    phone2: 'phone2',
    city: 'city',
    street: 'street',
    houseNum: 'houseNum',
    email: 'email',
    emailSuffix: 'emailSuffix',
    notes: 'notes',
    registrationDate: 'registrationDate',
    officeNotes: 'officeNotes',
    isDeleted: 'isDeleted'
  };

  export type CustomerScalarFieldEnum = (typeof CustomerScalarFieldEnum)[keyof typeof CustomerScalarFieldEnum]


  export const AuditLogScalarFieldEnum: {
    id: 'id',
    entityType: 'entityType',
    entityId: 'entityId',
    action: 'action',
    changesJson: 'changesJson',
    createdAt: 'createdAt',
    employeeId: 'employeeId'
  };

  export type AuditLogScalarFieldEnum = (typeof AuditLogScalarFieldEnum)[keyof typeof AuditLogScalarFieldEnum]


  export const EmployeeScalarFieldEnum: {
    id: 'id',
    firstName: 'firstName',
    lastName: 'lastName',
    phone1: 'phone1',
    phone2: 'phone2',
    city: 'city',
    street: 'street',
    houseNum: 'houseNum',
    email: 'email',
    joinDate: 'joinDate',
    fullName: 'fullName',
    notes: 'notes',
    emailSuffix: 'emailSuffix',
    roleId: 'roleId',
    password: 'password',
    isActive: 'isActive',
    hourlyWage: 'hourlyWage',
    paymentMethod: 'paymentMethod',
    travelExpenses: 'travelExpenses'
  };

  export type EmployeeScalarFieldEnum = (typeof EmployeeScalarFieldEnum)[keyof typeof EmployeeScalarFieldEnum]


  export const ShiftScalarFieldEnum: {
    id: 'id',
    employeeId: 'employeeId',
    entryTime: 'entryTime',
    exitTime: 'exitTime',
    hebrewDate: 'hebrewDate',
    date: 'date',
    totalMinutes: 'totalMinutes',
    hourlyWageSnapshot: 'hourlyWageSnapshot',
    travelExpensesSnapshot: 'travelExpensesSnapshot',
    totalCalculated: 'totalCalculated',
    paymentMethod: 'paymentMethod',
    notes: 'notes',
    isDeleted: 'isDeleted'
  };

  export type ShiftScalarFieldEnum = (typeof ShiftScalarFieldEnum)[keyof typeof ShiftScalarFieldEnum]


  export const DressModelScalarFieldEnum: {
    id: 'id',
    name: 'name',
    barcodePrefix: 'barcodePrefix',
    priceCategory: 'priceCategory',
    notes: 'notes',
    inInspection: 'inInspection',
    imageUrl: 'imageUrl',
    entryDateToRepo: 'entryDateToRepo',
    exitDateFromRepo: 'exitDateFromRepo',
    isDeleted: 'isDeleted',
    deletedAt: 'deletedAt'
  };

  export type DressModelScalarFieldEnum = (typeof DressModelScalarFieldEnum)[keyof typeof DressModelScalarFieldEnum]


  export const DressItemScalarFieldEnum: {
    id: 'id',
    barcodePrefix: 'barcodePrefix',
    dressModelId: 'dressModelId',
    dressName: 'dressName',
    sizeText: 'sizeText',
    serialNumber: 'serialNumber',
    dressBarcode: 'dressBarcode',
    location: 'location',
    locationNum: 'locationNum',
    quantity: 'quantity',
    inRepair: 'inRepair',
    notInUse: 'notInUse',
    notInUseSince: 'notInUseSince',
    entryDateToRepo: 'entryDateToRepo',
    isDeleted: 'isDeleted',
    deletedAt: 'deletedAt'
  };

  export type DressItemScalarFieldEnum = (typeof DressItemScalarFieldEnum)[keyof typeof DressItemScalarFieldEnum]


  export const OrderScalarFieldEnum: {
    id: 'id',
    orderId: 'orderId',
    customerId: 'customerId',
    totalAmount: 'totalAmount',
    paymentDate: 'paymentDate',
    paymentMethod: 'paymentMethod',
    status: 'status',
    notes: 'notes',
    isPaid: 'isPaid',
    isDeleted: 'isDeleted',
    orderNotes: 'orderNotes',
    eventDate: 'eventDate',
    eventDateHebrew: 'eventDateHebrew',
    returnDate: 'returnDate',
    isWeekdayEvent: 'isWeekdayEvent',
    orderDate: 'orderDate',
    isAbroad: 'isAbroad',
    fromDate: 'fromDate',
    toDate: 'toDate'
  };

  export type OrderScalarFieldEnum = (typeof OrderScalarFieldEnum)[keyof typeof OrderScalarFieldEnum]


  export const PaymentScalarFieldEnum: {
    id: 'id',
    customerId: 'customerId',
    orderId: 'orderId',
    amount: 'amount',
    paymentDate: 'paymentDate',
    paymentMethod: 'paymentMethod',
    notes: 'notes',
    isDeleted: 'isDeleted'
  };

  export type PaymentScalarFieldEnum = (typeof PaymentScalarFieldEnum)[keyof typeof PaymentScalarFieldEnum]


  export const PaymentObligationScalarFieldEnum: {
    id: 'id',
    orderId: 'orderId',
    productId: 'productId',
    amount: 'amount',
    quantity: 'quantity',
    description: 'description',
    createdAt: 'createdAt',
    isDeleted: 'isDeleted',
    isRefund: 'isRefund',
    isManual: 'isManual'
  };

  export type PaymentObligationScalarFieldEnum = (typeof PaymentObligationScalarFieldEnum)[keyof typeof PaymentObligationScalarFieldEnum]


  export const OrderItemScalarFieldEnum: {
    id: 'id',
    orderId: 'orderId',
    dressItemId: 'dressItemId',
    price: 'price',
    quantity: 'quantity',
    description: 'description',
    sizeText: 'sizeText',
    repairs: 'repairs',
    basePrice: 'basePrice',
    finalPrice: 'finalPrice',
    barcode: 'barcode',
    barcodePrefix: 'barcodePrefix',
    size: 'size',
    isTaken: 'isTaken',
    isReturned: 'isReturned',
    returnedOk: 'returnedOk',
    takenDate: 'takenDate',
    returnDate: 'returnDate',
    isDeleted: 'isDeleted',
    deletedAt: 'deletedAt',
    neckAlteration: 'neckAlteration',
    lengthAlteration: 'lengthAlteration',
    sleeveAlteration: 'sleeveAlteration',
    alterationDetails: 'alterationDetails',
    alterationDone: 'alterationDone'
  };

  export type OrderItemScalarFieldEnum = (typeof OrderItemScalarFieldEnum)[keyof typeof OrderItemScalarFieldEnum]


  export const PriceListScalarFieldEnum: {
    id: 'id',
    description: 'description',
    fromSize: 'fromSize',
    toSize: 'toSize',
    price: 'price',
    startDate: 'startDate',
    endDate: 'endDate',
    category: 'category',
    deposit: 'deposit'
  };

  export type PriceListScalarFieldEnum = (typeof PriceListScalarFieldEnum)[keyof typeof PriceListScalarFieldEnum]


  export const SystemSettingScalarFieldEnum: {
    id: 'id',
    key: 'key',
    value: 'value',
    name: 'name',
    category: 'category',
    notes: 'notes',
    type: 'type'
  };

  export type SystemSettingScalarFieldEnum = (typeof SystemSettingScalarFieldEnum)[keyof typeof SystemSettingScalarFieldEnum]


  export const PriceRuleScalarFieldEnum: {
    id: 'id',
    description: 'description',
    minSize: 'minSize',
    maxSize: 'maxSize',
    price: 'price',
    startDate: 'startDate',
    endDate: 'endDate',
    category: 'category',
    refund: 'refund'
  };

  export type PriceRuleScalarFieldEnum = (typeof PriceRuleScalarFieldEnum)[keyof typeof PriceRuleScalarFieldEnum]


  export const PageVisitLogScalarFieldEnum: {
    id: 'id',
    pageUrl: 'pageUrl',
    employeeId: 'employeeId',
    employeeName: 'employeeName',
    timestamp: 'timestamp',
    loadingError: 'loadingError',
    isGuest: 'isGuest'
  };

  export type PageVisitLogScalarFieldEnum = (typeof PageVisitLogScalarFieldEnum)[keyof typeof PageVisitLogScalarFieldEnum]


  export const EmailLogScalarFieldEnum: {
    id: 'id',
    to: 'to',
    cc: 'cc',
    subject: 'subject',
    body: 'body',
    fileName: 'fileName',
    status: 'status',
    errorMessage: 'errorMessage',
    customerId: 'customerId',
    employeeId: 'employeeId',
    sentAt: 'sentAt'
  };

  export type EmailLogScalarFieldEnum = (typeof EmailLogScalarFieldEnum)[keyof typeof EmailLogScalarFieldEnum]


  export const SortOrder: {
    asc: 'asc',
    desc: 'desc'
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]


  export const NullsOrder: {
    first: 'first',
    last: 'last'
  };

  export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder]


  /**
   * Field references 
   */


  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int'>
    


  /**
   * Reference to a field of type 'String'
   */
  export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String'>
    


  /**
   * Reference to a field of type 'Boolean'
   */
  export type BooleanFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Boolean'>
    


  /**
   * Reference to a field of type 'DateTime'
   */
  export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime'>
    


  /**
   * Reference to a field of type 'Float'
   */
  export type FloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float'>
    
  /**
   * Deep Input Types
   */


  export type CustomerWhereInput = {
    AND?: CustomerWhereInput | CustomerWhereInput[]
    OR?: CustomerWhereInput[]
    NOT?: CustomerWhereInput | CustomerWhereInput[]
    id?: IntFilter<"Customer"> | number
    firstName?: StringNullableFilter<"Customer"> | string | null
    lastName?: StringNullableFilter<"Customer"> | string | null
    phone1?: StringNullableFilter<"Customer"> | string | null
    phone2?: StringNullableFilter<"Customer"> | string | null
    city?: StringNullableFilter<"Customer"> | string | null
    street?: StringNullableFilter<"Customer"> | string | null
    houseNum?: IntNullableFilter<"Customer"> | number | null
    email?: StringNullableFilter<"Customer"> | string | null
    emailSuffix?: StringNullableFilter<"Customer"> | string | null
    notes?: StringNullableFilter<"Customer"> | string | null
    registrationDate?: StringNullableFilter<"Customer"> | string | null
    officeNotes?: StringNullableFilter<"Customer"> | string | null
    isDeleted?: BoolFilter<"Customer"> | boolean
    orders?: OrderListRelationFilter
    payments?: PaymentListRelationFilter
  }

  export type CustomerOrderByWithRelationInput = {
    id?: SortOrder
    firstName?: SortOrderInput | SortOrder
    lastName?: SortOrderInput | SortOrder
    phone1?: SortOrderInput | SortOrder
    phone2?: SortOrderInput | SortOrder
    city?: SortOrderInput | SortOrder
    street?: SortOrderInput | SortOrder
    houseNum?: SortOrderInput | SortOrder
    email?: SortOrderInput | SortOrder
    emailSuffix?: SortOrderInput | SortOrder
    notes?: SortOrderInput | SortOrder
    registrationDate?: SortOrderInput | SortOrder
    officeNotes?: SortOrderInput | SortOrder
    isDeleted?: SortOrder
    orders?: OrderOrderByRelationAggregateInput
    payments?: PaymentOrderByRelationAggregateInput
  }

  export type CustomerWhereUniqueInput = Prisma.AtLeast<{
    id?: number
    AND?: CustomerWhereInput | CustomerWhereInput[]
    OR?: CustomerWhereInput[]
    NOT?: CustomerWhereInput | CustomerWhereInput[]
    firstName?: StringNullableFilter<"Customer"> | string | null
    lastName?: StringNullableFilter<"Customer"> | string | null
    phone1?: StringNullableFilter<"Customer"> | string | null
    phone2?: StringNullableFilter<"Customer"> | string | null
    city?: StringNullableFilter<"Customer"> | string | null
    street?: StringNullableFilter<"Customer"> | string | null
    houseNum?: IntNullableFilter<"Customer"> | number | null
    email?: StringNullableFilter<"Customer"> | string | null
    emailSuffix?: StringNullableFilter<"Customer"> | string | null
    notes?: StringNullableFilter<"Customer"> | string | null
    registrationDate?: StringNullableFilter<"Customer"> | string | null
    officeNotes?: StringNullableFilter<"Customer"> | string | null
    isDeleted?: BoolFilter<"Customer"> | boolean
    orders?: OrderListRelationFilter
    payments?: PaymentListRelationFilter
  }, "id">

  export type CustomerOrderByWithAggregationInput = {
    id?: SortOrder
    firstName?: SortOrderInput | SortOrder
    lastName?: SortOrderInput | SortOrder
    phone1?: SortOrderInput | SortOrder
    phone2?: SortOrderInput | SortOrder
    city?: SortOrderInput | SortOrder
    street?: SortOrderInput | SortOrder
    houseNum?: SortOrderInput | SortOrder
    email?: SortOrderInput | SortOrder
    emailSuffix?: SortOrderInput | SortOrder
    notes?: SortOrderInput | SortOrder
    registrationDate?: SortOrderInput | SortOrder
    officeNotes?: SortOrderInput | SortOrder
    isDeleted?: SortOrder
    _count?: CustomerCountOrderByAggregateInput
    _avg?: CustomerAvgOrderByAggregateInput
    _max?: CustomerMaxOrderByAggregateInput
    _min?: CustomerMinOrderByAggregateInput
    _sum?: CustomerSumOrderByAggregateInput
  }

  export type CustomerScalarWhereWithAggregatesInput = {
    AND?: CustomerScalarWhereWithAggregatesInput | CustomerScalarWhereWithAggregatesInput[]
    OR?: CustomerScalarWhereWithAggregatesInput[]
    NOT?: CustomerScalarWhereWithAggregatesInput | CustomerScalarWhereWithAggregatesInput[]
    id?: IntWithAggregatesFilter<"Customer"> | number
    firstName?: StringNullableWithAggregatesFilter<"Customer"> | string | null
    lastName?: StringNullableWithAggregatesFilter<"Customer"> | string | null
    phone1?: StringNullableWithAggregatesFilter<"Customer"> | string | null
    phone2?: StringNullableWithAggregatesFilter<"Customer"> | string | null
    city?: StringNullableWithAggregatesFilter<"Customer"> | string | null
    street?: StringNullableWithAggregatesFilter<"Customer"> | string | null
    houseNum?: IntNullableWithAggregatesFilter<"Customer"> | number | null
    email?: StringNullableWithAggregatesFilter<"Customer"> | string | null
    emailSuffix?: StringNullableWithAggregatesFilter<"Customer"> | string | null
    notes?: StringNullableWithAggregatesFilter<"Customer"> | string | null
    registrationDate?: StringNullableWithAggregatesFilter<"Customer"> | string | null
    officeNotes?: StringNullableWithAggregatesFilter<"Customer"> | string | null
    isDeleted?: BoolWithAggregatesFilter<"Customer"> | boolean
  }

  export type AuditLogWhereInput = {
    AND?: AuditLogWhereInput | AuditLogWhereInput[]
    OR?: AuditLogWhereInput[]
    NOT?: AuditLogWhereInput | AuditLogWhereInput[]
    id?: IntFilter<"AuditLog"> | number
    entityType?: StringFilter<"AuditLog"> | string
    entityId?: IntFilter<"AuditLog"> | number
    action?: StringFilter<"AuditLog"> | string
    changesJson?: StringFilter<"AuditLog"> | string
    createdAt?: DateTimeFilter<"AuditLog"> | Date | string
    employeeId?: IntNullableFilter<"AuditLog"> | number | null
  }

  export type AuditLogOrderByWithRelationInput = {
    id?: SortOrder
    entityType?: SortOrder
    entityId?: SortOrder
    action?: SortOrder
    changesJson?: SortOrder
    createdAt?: SortOrder
    employeeId?: SortOrderInput | SortOrder
  }

  export type AuditLogWhereUniqueInput = Prisma.AtLeast<{
    id?: number
    AND?: AuditLogWhereInput | AuditLogWhereInput[]
    OR?: AuditLogWhereInput[]
    NOT?: AuditLogWhereInput | AuditLogWhereInput[]
    entityType?: StringFilter<"AuditLog"> | string
    entityId?: IntFilter<"AuditLog"> | number
    action?: StringFilter<"AuditLog"> | string
    changesJson?: StringFilter<"AuditLog"> | string
    createdAt?: DateTimeFilter<"AuditLog"> | Date | string
    employeeId?: IntNullableFilter<"AuditLog"> | number | null
  }, "id">

  export type AuditLogOrderByWithAggregationInput = {
    id?: SortOrder
    entityType?: SortOrder
    entityId?: SortOrder
    action?: SortOrder
    changesJson?: SortOrder
    createdAt?: SortOrder
    employeeId?: SortOrderInput | SortOrder
    _count?: AuditLogCountOrderByAggregateInput
    _avg?: AuditLogAvgOrderByAggregateInput
    _max?: AuditLogMaxOrderByAggregateInput
    _min?: AuditLogMinOrderByAggregateInput
    _sum?: AuditLogSumOrderByAggregateInput
  }

  export type AuditLogScalarWhereWithAggregatesInput = {
    AND?: AuditLogScalarWhereWithAggregatesInput | AuditLogScalarWhereWithAggregatesInput[]
    OR?: AuditLogScalarWhereWithAggregatesInput[]
    NOT?: AuditLogScalarWhereWithAggregatesInput | AuditLogScalarWhereWithAggregatesInput[]
    id?: IntWithAggregatesFilter<"AuditLog"> | number
    entityType?: StringWithAggregatesFilter<"AuditLog"> | string
    entityId?: IntWithAggregatesFilter<"AuditLog"> | number
    action?: StringWithAggregatesFilter<"AuditLog"> | string
    changesJson?: StringWithAggregatesFilter<"AuditLog"> | string
    createdAt?: DateTimeWithAggregatesFilter<"AuditLog"> | Date | string
    employeeId?: IntNullableWithAggregatesFilter<"AuditLog"> | number | null
  }

  export type EmployeeWhereInput = {
    AND?: EmployeeWhereInput | EmployeeWhereInput[]
    OR?: EmployeeWhereInput[]
    NOT?: EmployeeWhereInput | EmployeeWhereInput[]
    id?: IntFilter<"Employee"> | number
    firstName?: StringNullableFilter<"Employee"> | string | null
    lastName?: StringNullableFilter<"Employee"> | string | null
    phone1?: StringNullableFilter<"Employee"> | string | null
    phone2?: StringNullableFilter<"Employee"> | string | null
    city?: StringNullableFilter<"Employee"> | string | null
    street?: StringNullableFilter<"Employee"> | string | null
    houseNum?: StringNullableFilter<"Employee"> | string | null
    email?: StringNullableFilter<"Employee"> | string | null
    joinDate?: DateTimeNullableFilter<"Employee"> | Date | string | null
    fullName?: StringNullableFilter<"Employee"> | string | null
    notes?: StringNullableFilter<"Employee"> | string | null
    emailSuffix?: StringNullableFilter<"Employee"> | string | null
    roleId?: IntNullableFilter<"Employee"> | number | null
    password?: StringNullableFilter<"Employee"> | string | null
    isActive?: BoolFilter<"Employee"> | boolean
    hourlyWage?: FloatNullableFilter<"Employee"> | number | null
    paymentMethod?: StringNullableFilter<"Employee"> | string | null
    travelExpenses?: BoolNullableFilter<"Employee"> | boolean | null
    pageVisits?: PageVisitLogListRelationFilter
    shifts?: ShiftListRelationFilter
  }

  export type EmployeeOrderByWithRelationInput = {
    id?: SortOrder
    firstName?: SortOrderInput | SortOrder
    lastName?: SortOrderInput | SortOrder
    phone1?: SortOrderInput | SortOrder
    phone2?: SortOrderInput | SortOrder
    city?: SortOrderInput | SortOrder
    street?: SortOrderInput | SortOrder
    houseNum?: SortOrderInput | SortOrder
    email?: SortOrderInput | SortOrder
    joinDate?: SortOrderInput | SortOrder
    fullName?: SortOrderInput | SortOrder
    notes?: SortOrderInput | SortOrder
    emailSuffix?: SortOrderInput | SortOrder
    roleId?: SortOrderInput | SortOrder
    password?: SortOrderInput | SortOrder
    isActive?: SortOrder
    hourlyWage?: SortOrderInput | SortOrder
    paymentMethod?: SortOrderInput | SortOrder
    travelExpenses?: SortOrderInput | SortOrder
    pageVisits?: PageVisitLogOrderByRelationAggregateInput
    shifts?: ShiftOrderByRelationAggregateInput
  }

  export type EmployeeWhereUniqueInput = Prisma.AtLeast<{
    id?: number
    AND?: EmployeeWhereInput | EmployeeWhereInput[]
    OR?: EmployeeWhereInput[]
    NOT?: EmployeeWhereInput | EmployeeWhereInput[]
    firstName?: StringNullableFilter<"Employee"> | string | null
    lastName?: StringNullableFilter<"Employee"> | string | null
    phone1?: StringNullableFilter<"Employee"> | string | null
    phone2?: StringNullableFilter<"Employee"> | string | null
    city?: StringNullableFilter<"Employee"> | string | null
    street?: StringNullableFilter<"Employee"> | string | null
    houseNum?: StringNullableFilter<"Employee"> | string | null
    email?: StringNullableFilter<"Employee"> | string | null
    joinDate?: DateTimeNullableFilter<"Employee"> | Date | string | null
    fullName?: StringNullableFilter<"Employee"> | string | null
    notes?: StringNullableFilter<"Employee"> | string | null
    emailSuffix?: StringNullableFilter<"Employee"> | string | null
    roleId?: IntNullableFilter<"Employee"> | number | null
    password?: StringNullableFilter<"Employee"> | string | null
    isActive?: BoolFilter<"Employee"> | boolean
    hourlyWage?: FloatNullableFilter<"Employee"> | number | null
    paymentMethod?: StringNullableFilter<"Employee"> | string | null
    travelExpenses?: BoolNullableFilter<"Employee"> | boolean | null
    pageVisits?: PageVisitLogListRelationFilter
    shifts?: ShiftListRelationFilter
  }, "id">

  export type EmployeeOrderByWithAggregationInput = {
    id?: SortOrder
    firstName?: SortOrderInput | SortOrder
    lastName?: SortOrderInput | SortOrder
    phone1?: SortOrderInput | SortOrder
    phone2?: SortOrderInput | SortOrder
    city?: SortOrderInput | SortOrder
    street?: SortOrderInput | SortOrder
    houseNum?: SortOrderInput | SortOrder
    email?: SortOrderInput | SortOrder
    joinDate?: SortOrderInput | SortOrder
    fullName?: SortOrderInput | SortOrder
    notes?: SortOrderInput | SortOrder
    emailSuffix?: SortOrderInput | SortOrder
    roleId?: SortOrderInput | SortOrder
    password?: SortOrderInput | SortOrder
    isActive?: SortOrder
    hourlyWage?: SortOrderInput | SortOrder
    paymentMethod?: SortOrderInput | SortOrder
    travelExpenses?: SortOrderInput | SortOrder
    _count?: EmployeeCountOrderByAggregateInput
    _avg?: EmployeeAvgOrderByAggregateInput
    _max?: EmployeeMaxOrderByAggregateInput
    _min?: EmployeeMinOrderByAggregateInput
    _sum?: EmployeeSumOrderByAggregateInput
  }

  export type EmployeeScalarWhereWithAggregatesInput = {
    AND?: EmployeeScalarWhereWithAggregatesInput | EmployeeScalarWhereWithAggregatesInput[]
    OR?: EmployeeScalarWhereWithAggregatesInput[]
    NOT?: EmployeeScalarWhereWithAggregatesInput | EmployeeScalarWhereWithAggregatesInput[]
    id?: IntWithAggregatesFilter<"Employee"> | number
    firstName?: StringNullableWithAggregatesFilter<"Employee"> | string | null
    lastName?: StringNullableWithAggregatesFilter<"Employee"> | string | null
    phone1?: StringNullableWithAggregatesFilter<"Employee"> | string | null
    phone2?: StringNullableWithAggregatesFilter<"Employee"> | string | null
    city?: StringNullableWithAggregatesFilter<"Employee"> | string | null
    street?: StringNullableWithAggregatesFilter<"Employee"> | string | null
    houseNum?: StringNullableWithAggregatesFilter<"Employee"> | string | null
    email?: StringNullableWithAggregatesFilter<"Employee"> | string | null
    joinDate?: DateTimeNullableWithAggregatesFilter<"Employee"> | Date | string | null
    fullName?: StringNullableWithAggregatesFilter<"Employee"> | string | null
    notes?: StringNullableWithAggregatesFilter<"Employee"> | string | null
    emailSuffix?: StringNullableWithAggregatesFilter<"Employee"> | string | null
    roleId?: IntNullableWithAggregatesFilter<"Employee"> | number | null
    password?: StringNullableWithAggregatesFilter<"Employee"> | string | null
    isActive?: BoolWithAggregatesFilter<"Employee"> | boolean
    hourlyWage?: FloatNullableWithAggregatesFilter<"Employee"> | number | null
    paymentMethod?: StringNullableWithAggregatesFilter<"Employee"> | string | null
    travelExpenses?: BoolNullableWithAggregatesFilter<"Employee"> | boolean | null
  }

  export type ShiftWhereInput = {
    AND?: ShiftWhereInput | ShiftWhereInput[]
    OR?: ShiftWhereInput[]
    NOT?: ShiftWhereInput | ShiftWhereInput[]
    id?: IntFilter<"Shift"> | number
    employeeId?: IntFilter<"Shift"> | number
    entryTime?: DateTimeNullableFilter<"Shift"> | Date | string | null
    exitTime?: DateTimeNullableFilter<"Shift"> | Date | string | null
    hebrewDate?: StringNullableFilter<"Shift"> | string | null
    date?: DateTimeNullableFilter<"Shift"> | Date | string | null
    totalMinutes?: IntNullableFilter<"Shift"> | number | null
    hourlyWageSnapshot?: FloatNullableFilter<"Shift"> | number | null
    travelExpensesSnapshot?: FloatNullableFilter<"Shift"> | number | null
    totalCalculated?: FloatNullableFilter<"Shift"> | number | null
    paymentMethod?: StringNullableFilter<"Shift"> | string | null
    notes?: StringNullableFilter<"Shift"> | string | null
    isDeleted?: BoolFilter<"Shift"> | boolean
    employee?: XOR<EmployeeRelationFilter, EmployeeWhereInput>
  }

  export type ShiftOrderByWithRelationInput = {
    id?: SortOrder
    employeeId?: SortOrder
    entryTime?: SortOrderInput | SortOrder
    exitTime?: SortOrderInput | SortOrder
    hebrewDate?: SortOrderInput | SortOrder
    date?: SortOrderInput | SortOrder
    totalMinutes?: SortOrderInput | SortOrder
    hourlyWageSnapshot?: SortOrderInput | SortOrder
    travelExpensesSnapshot?: SortOrderInput | SortOrder
    totalCalculated?: SortOrderInput | SortOrder
    paymentMethod?: SortOrderInput | SortOrder
    notes?: SortOrderInput | SortOrder
    isDeleted?: SortOrder
    employee?: EmployeeOrderByWithRelationInput
  }

  export type ShiftWhereUniqueInput = Prisma.AtLeast<{
    id?: number
    AND?: ShiftWhereInput | ShiftWhereInput[]
    OR?: ShiftWhereInput[]
    NOT?: ShiftWhereInput | ShiftWhereInput[]
    employeeId?: IntFilter<"Shift"> | number
    entryTime?: DateTimeNullableFilter<"Shift"> | Date | string | null
    exitTime?: DateTimeNullableFilter<"Shift"> | Date | string | null
    hebrewDate?: StringNullableFilter<"Shift"> | string | null
    date?: DateTimeNullableFilter<"Shift"> | Date | string | null
    totalMinutes?: IntNullableFilter<"Shift"> | number | null
    hourlyWageSnapshot?: FloatNullableFilter<"Shift"> | number | null
    travelExpensesSnapshot?: FloatNullableFilter<"Shift"> | number | null
    totalCalculated?: FloatNullableFilter<"Shift"> | number | null
    paymentMethod?: StringNullableFilter<"Shift"> | string | null
    notes?: StringNullableFilter<"Shift"> | string | null
    isDeleted?: BoolFilter<"Shift"> | boolean
    employee?: XOR<EmployeeRelationFilter, EmployeeWhereInput>
  }, "id">

  export type ShiftOrderByWithAggregationInput = {
    id?: SortOrder
    employeeId?: SortOrder
    entryTime?: SortOrderInput | SortOrder
    exitTime?: SortOrderInput | SortOrder
    hebrewDate?: SortOrderInput | SortOrder
    date?: SortOrderInput | SortOrder
    totalMinutes?: SortOrderInput | SortOrder
    hourlyWageSnapshot?: SortOrderInput | SortOrder
    travelExpensesSnapshot?: SortOrderInput | SortOrder
    totalCalculated?: SortOrderInput | SortOrder
    paymentMethod?: SortOrderInput | SortOrder
    notes?: SortOrderInput | SortOrder
    isDeleted?: SortOrder
    _count?: ShiftCountOrderByAggregateInput
    _avg?: ShiftAvgOrderByAggregateInput
    _max?: ShiftMaxOrderByAggregateInput
    _min?: ShiftMinOrderByAggregateInput
    _sum?: ShiftSumOrderByAggregateInput
  }

  export type ShiftScalarWhereWithAggregatesInput = {
    AND?: ShiftScalarWhereWithAggregatesInput | ShiftScalarWhereWithAggregatesInput[]
    OR?: ShiftScalarWhereWithAggregatesInput[]
    NOT?: ShiftScalarWhereWithAggregatesInput | ShiftScalarWhereWithAggregatesInput[]
    id?: IntWithAggregatesFilter<"Shift"> | number
    employeeId?: IntWithAggregatesFilter<"Shift"> | number
    entryTime?: DateTimeNullableWithAggregatesFilter<"Shift"> | Date | string | null
    exitTime?: DateTimeNullableWithAggregatesFilter<"Shift"> | Date | string | null
    hebrewDate?: StringNullableWithAggregatesFilter<"Shift"> | string | null
    date?: DateTimeNullableWithAggregatesFilter<"Shift"> | Date | string | null
    totalMinutes?: IntNullableWithAggregatesFilter<"Shift"> | number | null
    hourlyWageSnapshot?: FloatNullableWithAggregatesFilter<"Shift"> | number | null
    travelExpensesSnapshot?: FloatNullableWithAggregatesFilter<"Shift"> | number | null
    totalCalculated?: FloatNullableWithAggregatesFilter<"Shift"> | number | null
    paymentMethod?: StringNullableWithAggregatesFilter<"Shift"> | string | null
    notes?: StringNullableWithAggregatesFilter<"Shift"> | string | null
    isDeleted?: BoolWithAggregatesFilter<"Shift"> | boolean
  }

  export type DressModelWhereInput = {
    AND?: DressModelWhereInput | DressModelWhereInput[]
    OR?: DressModelWhereInput[]
    NOT?: DressModelWhereInput | DressModelWhereInput[]
    id?: IntFilter<"DressModel"> | number
    name?: StringNullableFilter<"DressModel"> | string | null
    barcodePrefix?: IntNullableFilter<"DressModel"> | number | null
    priceCategory?: StringNullableFilter<"DressModel"> | string | null
    notes?: StringNullableFilter<"DressModel"> | string | null
    inInspection?: BoolFilter<"DressModel"> | boolean
    imageUrl?: StringNullableFilter<"DressModel"> | string | null
    entryDateToRepo?: DateTimeNullableFilter<"DressModel"> | Date | string | null
    exitDateFromRepo?: DateTimeNullableFilter<"DressModel"> | Date | string | null
    isDeleted?: BoolFilter<"DressModel"> | boolean
    deletedAt?: DateTimeNullableFilter<"DressModel"> | Date | string | null
    items?: DressItemListRelationFilter
  }

  export type DressModelOrderByWithRelationInput = {
    id?: SortOrder
    name?: SortOrderInput | SortOrder
    barcodePrefix?: SortOrderInput | SortOrder
    priceCategory?: SortOrderInput | SortOrder
    notes?: SortOrderInput | SortOrder
    inInspection?: SortOrder
    imageUrl?: SortOrderInput | SortOrder
    entryDateToRepo?: SortOrderInput | SortOrder
    exitDateFromRepo?: SortOrderInput | SortOrder
    isDeleted?: SortOrder
    deletedAt?: SortOrderInput | SortOrder
    items?: DressItemOrderByRelationAggregateInput
  }

  export type DressModelWhereUniqueInput = Prisma.AtLeast<{
    id?: number
    name?: string
    AND?: DressModelWhereInput | DressModelWhereInput[]
    OR?: DressModelWhereInput[]
    NOT?: DressModelWhereInput | DressModelWhereInput[]
    barcodePrefix?: IntNullableFilter<"DressModel"> | number | null
    priceCategory?: StringNullableFilter<"DressModel"> | string | null
    notes?: StringNullableFilter<"DressModel"> | string | null
    inInspection?: BoolFilter<"DressModel"> | boolean
    imageUrl?: StringNullableFilter<"DressModel"> | string | null
    entryDateToRepo?: DateTimeNullableFilter<"DressModel"> | Date | string | null
    exitDateFromRepo?: DateTimeNullableFilter<"DressModel"> | Date | string | null
    isDeleted?: BoolFilter<"DressModel"> | boolean
    deletedAt?: DateTimeNullableFilter<"DressModel"> | Date | string | null
    items?: DressItemListRelationFilter
  }, "id" | "name">

  export type DressModelOrderByWithAggregationInput = {
    id?: SortOrder
    name?: SortOrderInput | SortOrder
    barcodePrefix?: SortOrderInput | SortOrder
    priceCategory?: SortOrderInput | SortOrder
    notes?: SortOrderInput | SortOrder
    inInspection?: SortOrder
    imageUrl?: SortOrderInput | SortOrder
    entryDateToRepo?: SortOrderInput | SortOrder
    exitDateFromRepo?: SortOrderInput | SortOrder
    isDeleted?: SortOrder
    deletedAt?: SortOrderInput | SortOrder
    _count?: DressModelCountOrderByAggregateInput
    _avg?: DressModelAvgOrderByAggregateInput
    _max?: DressModelMaxOrderByAggregateInput
    _min?: DressModelMinOrderByAggregateInput
    _sum?: DressModelSumOrderByAggregateInput
  }

  export type DressModelScalarWhereWithAggregatesInput = {
    AND?: DressModelScalarWhereWithAggregatesInput | DressModelScalarWhereWithAggregatesInput[]
    OR?: DressModelScalarWhereWithAggregatesInput[]
    NOT?: DressModelScalarWhereWithAggregatesInput | DressModelScalarWhereWithAggregatesInput[]
    id?: IntWithAggregatesFilter<"DressModel"> | number
    name?: StringNullableWithAggregatesFilter<"DressModel"> | string | null
    barcodePrefix?: IntNullableWithAggregatesFilter<"DressModel"> | number | null
    priceCategory?: StringNullableWithAggregatesFilter<"DressModel"> | string | null
    notes?: StringNullableWithAggregatesFilter<"DressModel"> | string | null
    inInspection?: BoolWithAggregatesFilter<"DressModel"> | boolean
    imageUrl?: StringNullableWithAggregatesFilter<"DressModel"> | string | null
    entryDateToRepo?: DateTimeNullableWithAggregatesFilter<"DressModel"> | Date | string | null
    exitDateFromRepo?: DateTimeNullableWithAggregatesFilter<"DressModel"> | Date | string | null
    isDeleted?: BoolWithAggregatesFilter<"DressModel"> | boolean
    deletedAt?: DateTimeNullableWithAggregatesFilter<"DressModel"> | Date | string | null
  }

  export type DressItemWhereInput = {
    AND?: DressItemWhereInput | DressItemWhereInput[]
    OR?: DressItemWhereInput[]
    NOT?: DressItemWhereInput | DressItemWhereInput[]
    id?: IntFilter<"DressItem"> | number
    barcodePrefix?: IntNullableFilter<"DressItem"> | number | null
    dressModelId?: IntNullableFilter<"DressItem"> | number | null
    dressName?: StringNullableFilter<"DressItem"> | string | null
    sizeText?: StringNullableFilter<"DressItem"> | string | null
    serialNumber?: IntNullableFilter<"DressItem"> | number | null
    dressBarcode?: StringNullableFilter<"DressItem"> | string | null
    location?: StringNullableFilter<"DressItem"> | string | null
    locationNum?: IntNullableFilter<"DressItem"> | number | null
    quantity?: IntNullableFilter<"DressItem"> | number | null
    inRepair?: BoolFilter<"DressItem"> | boolean
    notInUse?: BoolFilter<"DressItem"> | boolean
    notInUseSince?: DateTimeNullableFilter<"DressItem"> | Date | string | null
    entryDateToRepo?: DateTimeNullableFilter<"DressItem"> | Date | string | null
    isDeleted?: BoolFilter<"DressItem"> | boolean
    deletedAt?: DateTimeNullableFilter<"DressItem"> | Date | string | null
    dress?: XOR<DressModelNullableRelationFilter, DressModelWhereInput> | null
    orderItems?: OrderItemListRelationFilter
  }

  export type DressItemOrderByWithRelationInput = {
    id?: SortOrder
    barcodePrefix?: SortOrderInput | SortOrder
    dressModelId?: SortOrderInput | SortOrder
    dressName?: SortOrderInput | SortOrder
    sizeText?: SortOrderInput | SortOrder
    serialNumber?: SortOrderInput | SortOrder
    dressBarcode?: SortOrderInput | SortOrder
    location?: SortOrderInput | SortOrder
    locationNum?: SortOrderInput | SortOrder
    quantity?: SortOrderInput | SortOrder
    inRepair?: SortOrder
    notInUse?: SortOrder
    notInUseSince?: SortOrderInput | SortOrder
    entryDateToRepo?: SortOrderInput | SortOrder
    isDeleted?: SortOrder
    deletedAt?: SortOrderInput | SortOrder
    dress?: DressModelOrderByWithRelationInput
    orderItems?: OrderItemOrderByRelationAggregateInput
  }

  export type DressItemWhereUniqueInput = Prisma.AtLeast<{
    id?: number
    AND?: DressItemWhereInput | DressItemWhereInput[]
    OR?: DressItemWhereInput[]
    NOT?: DressItemWhereInput | DressItemWhereInput[]
    barcodePrefix?: IntNullableFilter<"DressItem"> | number | null
    dressModelId?: IntNullableFilter<"DressItem"> | number | null
    dressName?: StringNullableFilter<"DressItem"> | string | null
    sizeText?: StringNullableFilter<"DressItem"> | string | null
    serialNumber?: IntNullableFilter<"DressItem"> | number | null
    dressBarcode?: StringNullableFilter<"DressItem"> | string | null
    location?: StringNullableFilter<"DressItem"> | string | null
    locationNum?: IntNullableFilter<"DressItem"> | number | null
    quantity?: IntNullableFilter<"DressItem"> | number | null
    inRepair?: BoolFilter<"DressItem"> | boolean
    notInUse?: BoolFilter<"DressItem"> | boolean
    notInUseSince?: DateTimeNullableFilter<"DressItem"> | Date | string | null
    entryDateToRepo?: DateTimeNullableFilter<"DressItem"> | Date | string | null
    isDeleted?: BoolFilter<"DressItem"> | boolean
    deletedAt?: DateTimeNullableFilter<"DressItem"> | Date | string | null
    dress?: XOR<DressModelNullableRelationFilter, DressModelWhereInput> | null
    orderItems?: OrderItemListRelationFilter
  }, "id">

  export type DressItemOrderByWithAggregationInput = {
    id?: SortOrder
    barcodePrefix?: SortOrderInput | SortOrder
    dressModelId?: SortOrderInput | SortOrder
    dressName?: SortOrderInput | SortOrder
    sizeText?: SortOrderInput | SortOrder
    serialNumber?: SortOrderInput | SortOrder
    dressBarcode?: SortOrderInput | SortOrder
    location?: SortOrderInput | SortOrder
    locationNum?: SortOrderInput | SortOrder
    quantity?: SortOrderInput | SortOrder
    inRepair?: SortOrder
    notInUse?: SortOrder
    notInUseSince?: SortOrderInput | SortOrder
    entryDateToRepo?: SortOrderInput | SortOrder
    isDeleted?: SortOrder
    deletedAt?: SortOrderInput | SortOrder
    _count?: DressItemCountOrderByAggregateInput
    _avg?: DressItemAvgOrderByAggregateInput
    _max?: DressItemMaxOrderByAggregateInput
    _min?: DressItemMinOrderByAggregateInput
    _sum?: DressItemSumOrderByAggregateInput
  }

  export type DressItemScalarWhereWithAggregatesInput = {
    AND?: DressItemScalarWhereWithAggregatesInput | DressItemScalarWhereWithAggregatesInput[]
    OR?: DressItemScalarWhereWithAggregatesInput[]
    NOT?: DressItemScalarWhereWithAggregatesInput | DressItemScalarWhereWithAggregatesInput[]
    id?: IntWithAggregatesFilter<"DressItem"> | number
    barcodePrefix?: IntNullableWithAggregatesFilter<"DressItem"> | number | null
    dressModelId?: IntNullableWithAggregatesFilter<"DressItem"> | number | null
    dressName?: StringNullableWithAggregatesFilter<"DressItem"> | string | null
    sizeText?: StringNullableWithAggregatesFilter<"DressItem"> | string | null
    serialNumber?: IntNullableWithAggregatesFilter<"DressItem"> | number | null
    dressBarcode?: StringNullableWithAggregatesFilter<"DressItem"> | string | null
    location?: StringNullableWithAggregatesFilter<"DressItem"> | string | null
    locationNum?: IntNullableWithAggregatesFilter<"DressItem"> | number | null
    quantity?: IntNullableWithAggregatesFilter<"DressItem"> | number | null
    inRepair?: BoolWithAggregatesFilter<"DressItem"> | boolean
    notInUse?: BoolWithAggregatesFilter<"DressItem"> | boolean
    notInUseSince?: DateTimeNullableWithAggregatesFilter<"DressItem"> | Date | string | null
    entryDateToRepo?: DateTimeNullableWithAggregatesFilter<"DressItem"> | Date | string | null
    isDeleted?: BoolWithAggregatesFilter<"DressItem"> | boolean
    deletedAt?: DateTimeNullableWithAggregatesFilter<"DressItem"> | Date | string | null
  }

  export type OrderWhereInput = {
    AND?: OrderWhereInput | OrderWhereInput[]
    OR?: OrderWhereInput[]
    NOT?: OrderWhereInput | OrderWhereInput[]
    id?: IntFilter<"Order"> | number
    orderId?: IntFilter<"Order"> | number
    customerId?: IntNullableFilter<"Order"> | number | null
    totalAmount?: FloatNullableFilter<"Order"> | number | null
    paymentDate?: DateTimeNullableFilter<"Order"> | Date | string | null
    paymentMethod?: StringNullableFilter<"Order"> | string | null
    status?: StringNullableFilter<"Order"> | string | null
    notes?: StringNullableFilter<"Order"> | string | null
    isPaid?: BoolFilter<"Order"> | boolean
    isDeleted?: BoolFilter<"Order"> | boolean
    orderNotes?: StringNullableFilter<"Order"> | string | null
    eventDate?: DateTimeNullableFilter<"Order"> | Date | string | null
    eventDateHebrew?: StringNullableFilter<"Order"> | string | null
    returnDate?: DateTimeNullableFilter<"Order"> | Date | string | null
    isWeekdayEvent?: BoolFilter<"Order"> | boolean
    orderDate?: DateTimeNullableFilter<"Order"> | Date | string | null
    isAbroad?: BoolFilter<"Order"> | boolean
    fromDate?: DateTimeNullableFilter<"Order"> | Date | string | null
    toDate?: DateTimeNullableFilter<"Order"> | Date | string | null
    customer?: XOR<CustomerNullableRelationFilter, CustomerWhereInput> | null
    items?: OrderItemListRelationFilter
    payments?: PaymentListRelationFilter
    obligations?: PaymentObligationListRelationFilter
  }

  export type OrderOrderByWithRelationInput = {
    id?: SortOrder
    orderId?: SortOrder
    customerId?: SortOrderInput | SortOrder
    totalAmount?: SortOrderInput | SortOrder
    paymentDate?: SortOrderInput | SortOrder
    paymentMethod?: SortOrderInput | SortOrder
    status?: SortOrderInput | SortOrder
    notes?: SortOrderInput | SortOrder
    isPaid?: SortOrder
    isDeleted?: SortOrder
    orderNotes?: SortOrderInput | SortOrder
    eventDate?: SortOrderInput | SortOrder
    eventDateHebrew?: SortOrderInput | SortOrder
    returnDate?: SortOrderInput | SortOrder
    isWeekdayEvent?: SortOrder
    orderDate?: SortOrderInput | SortOrder
    isAbroad?: SortOrder
    fromDate?: SortOrderInput | SortOrder
    toDate?: SortOrderInput | SortOrder
    customer?: CustomerOrderByWithRelationInput
    items?: OrderItemOrderByRelationAggregateInput
    payments?: PaymentOrderByRelationAggregateInput
    obligations?: PaymentObligationOrderByRelationAggregateInput
  }

  export type OrderWhereUniqueInput = Prisma.AtLeast<{
    id?: number
    orderId?: number
    AND?: OrderWhereInput | OrderWhereInput[]
    OR?: OrderWhereInput[]
    NOT?: OrderWhereInput | OrderWhereInput[]
    customerId?: IntNullableFilter<"Order"> | number | null
    totalAmount?: FloatNullableFilter<"Order"> | number | null
    paymentDate?: DateTimeNullableFilter<"Order"> | Date | string | null
    paymentMethod?: StringNullableFilter<"Order"> | string | null
    status?: StringNullableFilter<"Order"> | string | null
    notes?: StringNullableFilter<"Order"> | string | null
    isPaid?: BoolFilter<"Order"> | boolean
    isDeleted?: BoolFilter<"Order"> | boolean
    orderNotes?: StringNullableFilter<"Order"> | string | null
    eventDate?: DateTimeNullableFilter<"Order"> | Date | string | null
    eventDateHebrew?: StringNullableFilter<"Order"> | string | null
    returnDate?: DateTimeNullableFilter<"Order"> | Date | string | null
    isWeekdayEvent?: BoolFilter<"Order"> | boolean
    orderDate?: DateTimeNullableFilter<"Order"> | Date | string | null
    isAbroad?: BoolFilter<"Order"> | boolean
    fromDate?: DateTimeNullableFilter<"Order"> | Date | string | null
    toDate?: DateTimeNullableFilter<"Order"> | Date | string | null
    customer?: XOR<CustomerNullableRelationFilter, CustomerWhereInput> | null
    items?: OrderItemListRelationFilter
    payments?: PaymentListRelationFilter
    obligations?: PaymentObligationListRelationFilter
  }, "id" | "orderId">

  export type OrderOrderByWithAggregationInput = {
    id?: SortOrder
    orderId?: SortOrder
    customerId?: SortOrderInput | SortOrder
    totalAmount?: SortOrderInput | SortOrder
    paymentDate?: SortOrderInput | SortOrder
    paymentMethod?: SortOrderInput | SortOrder
    status?: SortOrderInput | SortOrder
    notes?: SortOrderInput | SortOrder
    isPaid?: SortOrder
    isDeleted?: SortOrder
    orderNotes?: SortOrderInput | SortOrder
    eventDate?: SortOrderInput | SortOrder
    eventDateHebrew?: SortOrderInput | SortOrder
    returnDate?: SortOrderInput | SortOrder
    isWeekdayEvent?: SortOrder
    orderDate?: SortOrderInput | SortOrder
    isAbroad?: SortOrder
    fromDate?: SortOrderInput | SortOrder
    toDate?: SortOrderInput | SortOrder
    _count?: OrderCountOrderByAggregateInput
    _avg?: OrderAvgOrderByAggregateInput
    _max?: OrderMaxOrderByAggregateInput
    _min?: OrderMinOrderByAggregateInput
    _sum?: OrderSumOrderByAggregateInput
  }

  export type OrderScalarWhereWithAggregatesInput = {
    AND?: OrderScalarWhereWithAggregatesInput | OrderScalarWhereWithAggregatesInput[]
    OR?: OrderScalarWhereWithAggregatesInput[]
    NOT?: OrderScalarWhereWithAggregatesInput | OrderScalarWhereWithAggregatesInput[]
    id?: IntWithAggregatesFilter<"Order"> | number
    orderId?: IntWithAggregatesFilter<"Order"> | number
    customerId?: IntNullableWithAggregatesFilter<"Order"> | number | null
    totalAmount?: FloatNullableWithAggregatesFilter<"Order"> | number | null
    paymentDate?: DateTimeNullableWithAggregatesFilter<"Order"> | Date | string | null
    paymentMethod?: StringNullableWithAggregatesFilter<"Order"> | string | null
    status?: StringNullableWithAggregatesFilter<"Order"> | string | null
    notes?: StringNullableWithAggregatesFilter<"Order"> | string | null
    isPaid?: BoolWithAggregatesFilter<"Order"> | boolean
    isDeleted?: BoolWithAggregatesFilter<"Order"> | boolean
    orderNotes?: StringNullableWithAggregatesFilter<"Order"> | string | null
    eventDate?: DateTimeNullableWithAggregatesFilter<"Order"> | Date | string | null
    eventDateHebrew?: StringNullableWithAggregatesFilter<"Order"> | string | null
    returnDate?: DateTimeNullableWithAggregatesFilter<"Order"> | Date | string | null
    isWeekdayEvent?: BoolWithAggregatesFilter<"Order"> | boolean
    orderDate?: DateTimeNullableWithAggregatesFilter<"Order"> | Date | string | null
    isAbroad?: BoolWithAggregatesFilter<"Order"> | boolean
    fromDate?: DateTimeNullableWithAggregatesFilter<"Order"> | Date | string | null
    toDate?: DateTimeNullableWithAggregatesFilter<"Order"> | Date | string | null
  }

  export type PaymentWhereInput = {
    AND?: PaymentWhereInput | PaymentWhereInput[]
    OR?: PaymentWhereInput[]
    NOT?: PaymentWhereInput | PaymentWhereInput[]
    id?: IntFilter<"Payment"> | number
    customerId?: IntNullableFilter<"Payment"> | number | null
    orderId?: IntNullableFilter<"Payment"> | number | null
    amount?: FloatFilter<"Payment"> | number
    paymentDate?: DateTimeFilter<"Payment"> | Date | string
    paymentMethod?: StringNullableFilter<"Payment"> | string | null
    notes?: StringNullableFilter<"Payment"> | string | null
    isDeleted?: BoolFilter<"Payment"> | boolean
    customer?: XOR<CustomerNullableRelationFilter, CustomerWhereInput> | null
    order?: XOR<OrderNullableRelationFilter, OrderWhereInput> | null
  }

  export type PaymentOrderByWithRelationInput = {
    id?: SortOrder
    customerId?: SortOrderInput | SortOrder
    orderId?: SortOrderInput | SortOrder
    amount?: SortOrder
    paymentDate?: SortOrder
    paymentMethod?: SortOrderInput | SortOrder
    notes?: SortOrderInput | SortOrder
    isDeleted?: SortOrder
    customer?: CustomerOrderByWithRelationInput
    order?: OrderOrderByWithRelationInput
  }

  export type PaymentWhereUniqueInput = Prisma.AtLeast<{
    id?: number
    AND?: PaymentWhereInput | PaymentWhereInput[]
    OR?: PaymentWhereInput[]
    NOT?: PaymentWhereInput | PaymentWhereInput[]
    customerId?: IntNullableFilter<"Payment"> | number | null
    orderId?: IntNullableFilter<"Payment"> | number | null
    amount?: FloatFilter<"Payment"> | number
    paymentDate?: DateTimeFilter<"Payment"> | Date | string
    paymentMethod?: StringNullableFilter<"Payment"> | string | null
    notes?: StringNullableFilter<"Payment"> | string | null
    isDeleted?: BoolFilter<"Payment"> | boolean
    customer?: XOR<CustomerNullableRelationFilter, CustomerWhereInput> | null
    order?: XOR<OrderNullableRelationFilter, OrderWhereInput> | null
  }, "id">

  export type PaymentOrderByWithAggregationInput = {
    id?: SortOrder
    customerId?: SortOrderInput | SortOrder
    orderId?: SortOrderInput | SortOrder
    amount?: SortOrder
    paymentDate?: SortOrder
    paymentMethod?: SortOrderInput | SortOrder
    notes?: SortOrderInput | SortOrder
    isDeleted?: SortOrder
    _count?: PaymentCountOrderByAggregateInput
    _avg?: PaymentAvgOrderByAggregateInput
    _max?: PaymentMaxOrderByAggregateInput
    _min?: PaymentMinOrderByAggregateInput
    _sum?: PaymentSumOrderByAggregateInput
  }

  export type PaymentScalarWhereWithAggregatesInput = {
    AND?: PaymentScalarWhereWithAggregatesInput | PaymentScalarWhereWithAggregatesInput[]
    OR?: PaymentScalarWhereWithAggregatesInput[]
    NOT?: PaymentScalarWhereWithAggregatesInput | PaymentScalarWhereWithAggregatesInput[]
    id?: IntWithAggregatesFilter<"Payment"> | number
    customerId?: IntNullableWithAggregatesFilter<"Payment"> | number | null
    orderId?: IntNullableWithAggregatesFilter<"Payment"> | number | null
    amount?: FloatWithAggregatesFilter<"Payment"> | number
    paymentDate?: DateTimeWithAggregatesFilter<"Payment"> | Date | string
    paymentMethod?: StringNullableWithAggregatesFilter<"Payment"> | string | null
    notes?: StringNullableWithAggregatesFilter<"Payment"> | string | null
    isDeleted?: BoolWithAggregatesFilter<"Payment"> | boolean
  }

  export type PaymentObligationWhereInput = {
    AND?: PaymentObligationWhereInput | PaymentObligationWhereInput[]
    OR?: PaymentObligationWhereInput[]
    NOT?: PaymentObligationWhereInput | PaymentObligationWhereInput[]
    id?: IntFilter<"PaymentObligation"> | number
    orderId?: IntFilter<"PaymentObligation"> | number
    productId?: IntNullableFilter<"PaymentObligation"> | number | null
    amount?: FloatFilter<"PaymentObligation"> | number
    quantity?: IntFilter<"PaymentObligation"> | number
    description?: StringNullableFilter<"PaymentObligation"> | string | null
    createdAt?: DateTimeFilter<"PaymentObligation"> | Date | string
    isDeleted?: BoolFilter<"PaymentObligation"> | boolean
    isRefund?: BoolFilter<"PaymentObligation"> | boolean
    isManual?: BoolFilter<"PaymentObligation"> | boolean
    order?: XOR<OrderRelationFilter, OrderWhereInput>
  }

  export type PaymentObligationOrderByWithRelationInput = {
    id?: SortOrder
    orderId?: SortOrder
    productId?: SortOrderInput | SortOrder
    amount?: SortOrder
    quantity?: SortOrder
    description?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    isDeleted?: SortOrder
    isRefund?: SortOrder
    isManual?: SortOrder
    order?: OrderOrderByWithRelationInput
  }

  export type PaymentObligationWhereUniqueInput = Prisma.AtLeast<{
    id?: number
    AND?: PaymentObligationWhereInput | PaymentObligationWhereInput[]
    OR?: PaymentObligationWhereInput[]
    NOT?: PaymentObligationWhereInput | PaymentObligationWhereInput[]
    orderId?: IntFilter<"PaymentObligation"> | number
    productId?: IntNullableFilter<"PaymentObligation"> | number | null
    amount?: FloatFilter<"PaymentObligation"> | number
    quantity?: IntFilter<"PaymentObligation"> | number
    description?: StringNullableFilter<"PaymentObligation"> | string | null
    createdAt?: DateTimeFilter<"PaymentObligation"> | Date | string
    isDeleted?: BoolFilter<"PaymentObligation"> | boolean
    isRefund?: BoolFilter<"PaymentObligation"> | boolean
    isManual?: BoolFilter<"PaymentObligation"> | boolean
    order?: XOR<OrderRelationFilter, OrderWhereInput>
  }, "id">

  export type PaymentObligationOrderByWithAggregationInput = {
    id?: SortOrder
    orderId?: SortOrder
    productId?: SortOrderInput | SortOrder
    amount?: SortOrder
    quantity?: SortOrder
    description?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    isDeleted?: SortOrder
    isRefund?: SortOrder
    isManual?: SortOrder
    _count?: PaymentObligationCountOrderByAggregateInput
    _avg?: PaymentObligationAvgOrderByAggregateInput
    _max?: PaymentObligationMaxOrderByAggregateInput
    _min?: PaymentObligationMinOrderByAggregateInput
    _sum?: PaymentObligationSumOrderByAggregateInput
  }

  export type PaymentObligationScalarWhereWithAggregatesInput = {
    AND?: PaymentObligationScalarWhereWithAggregatesInput | PaymentObligationScalarWhereWithAggregatesInput[]
    OR?: PaymentObligationScalarWhereWithAggregatesInput[]
    NOT?: PaymentObligationScalarWhereWithAggregatesInput | PaymentObligationScalarWhereWithAggregatesInput[]
    id?: IntWithAggregatesFilter<"PaymentObligation"> | number
    orderId?: IntWithAggregatesFilter<"PaymentObligation"> | number
    productId?: IntNullableWithAggregatesFilter<"PaymentObligation"> | number | null
    amount?: FloatWithAggregatesFilter<"PaymentObligation"> | number
    quantity?: IntWithAggregatesFilter<"PaymentObligation"> | number
    description?: StringNullableWithAggregatesFilter<"PaymentObligation"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"PaymentObligation"> | Date | string
    isDeleted?: BoolWithAggregatesFilter<"PaymentObligation"> | boolean
    isRefund?: BoolWithAggregatesFilter<"PaymentObligation"> | boolean
    isManual?: BoolWithAggregatesFilter<"PaymentObligation"> | boolean
  }

  export type OrderItemWhereInput = {
    AND?: OrderItemWhereInput | OrderItemWhereInput[]
    OR?: OrderItemWhereInput[]
    NOT?: OrderItemWhereInput | OrderItemWhereInput[]
    id?: IntFilter<"OrderItem"> | number
    orderId?: IntNullableFilter<"OrderItem"> | number | null
    dressItemId?: IntNullableFilter<"OrderItem"> | number | null
    price?: FloatNullableFilter<"OrderItem"> | number | null
    quantity?: IntNullableFilter<"OrderItem"> | number | null
    description?: StringNullableFilter<"OrderItem"> | string | null
    sizeText?: StringNullableFilter<"OrderItem"> | string | null
    repairs?: StringNullableFilter<"OrderItem"> | string | null
    basePrice?: FloatNullableFilter<"OrderItem"> | number | null
    finalPrice?: FloatNullableFilter<"OrderItem"> | number | null
    barcode?: StringNullableFilter<"OrderItem"> | string | null
    barcodePrefix?: IntNullableFilter<"OrderItem"> | number | null
    size?: StringNullableFilter<"OrderItem"> | string | null
    isTaken?: BoolFilter<"OrderItem"> | boolean
    isReturned?: BoolFilter<"OrderItem"> | boolean
    returnedOk?: BoolFilter<"OrderItem"> | boolean
    takenDate?: DateTimeNullableFilter<"OrderItem"> | Date | string | null
    returnDate?: DateTimeNullableFilter<"OrderItem"> | Date | string | null
    isDeleted?: BoolFilter<"OrderItem"> | boolean
    deletedAt?: DateTimeNullableFilter<"OrderItem"> | Date | string | null
    neckAlteration?: IntNullableFilter<"OrderItem"> | number | null
    lengthAlteration?: StringNullableFilter<"OrderItem"> | string | null
    sleeveAlteration?: IntNullableFilter<"OrderItem"> | number | null
    alterationDetails?: StringNullableFilter<"OrderItem"> | string | null
    alterationDone?: BoolFilter<"OrderItem"> | boolean
    order?: XOR<OrderNullableRelationFilter, OrderWhereInput> | null
    dressItem?: XOR<DressItemNullableRelationFilter, DressItemWhereInput> | null
  }

  export type OrderItemOrderByWithRelationInput = {
    id?: SortOrder
    orderId?: SortOrderInput | SortOrder
    dressItemId?: SortOrderInput | SortOrder
    price?: SortOrderInput | SortOrder
    quantity?: SortOrderInput | SortOrder
    description?: SortOrderInput | SortOrder
    sizeText?: SortOrderInput | SortOrder
    repairs?: SortOrderInput | SortOrder
    basePrice?: SortOrderInput | SortOrder
    finalPrice?: SortOrderInput | SortOrder
    barcode?: SortOrderInput | SortOrder
    barcodePrefix?: SortOrderInput | SortOrder
    size?: SortOrderInput | SortOrder
    isTaken?: SortOrder
    isReturned?: SortOrder
    returnedOk?: SortOrder
    takenDate?: SortOrderInput | SortOrder
    returnDate?: SortOrderInput | SortOrder
    isDeleted?: SortOrder
    deletedAt?: SortOrderInput | SortOrder
    neckAlteration?: SortOrderInput | SortOrder
    lengthAlteration?: SortOrderInput | SortOrder
    sleeveAlteration?: SortOrderInput | SortOrder
    alterationDetails?: SortOrderInput | SortOrder
    alterationDone?: SortOrder
    order?: OrderOrderByWithRelationInput
    dressItem?: DressItemOrderByWithRelationInput
  }

  export type OrderItemWhereUniqueInput = Prisma.AtLeast<{
    id?: number
    AND?: OrderItemWhereInput | OrderItemWhereInput[]
    OR?: OrderItemWhereInput[]
    NOT?: OrderItemWhereInput | OrderItemWhereInput[]
    orderId?: IntNullableFilter<"OrderItem"> | number | null
    dressItemId?: IntNullableFilter<"OrderItem"> | number | null
    price?: FloatNullableFilter<"OrderItem"> | number | null
    quantity?: IntNullableFilter<"OrderItem"> | number | null
    description?: StringNullableFilter<"OrderItem"> | string | null
    sizeText?: StringNullableFilter<"OrderItem"> | string | null
    repairs?: StringNullableFilter<"OrderItem"> | string | null
    basePrice?: FloatNullableFilter<"OrderItem"> | number | null
    finalPrice?: FloatNullableFilter<"OrderItem"> | number | null
    barcode?: StringNullableFilter<"OrderItem"> | string | null
    barcodePrefix?: IntNullableFilter<"OrderItem"> | number | null
    size?: StringNullableFilter<"OrderItem"> | string | null
    isTaken?: BoolFilter<"OrderItem"> | boolean
    isReturned?: BoolFilter<"OrderItem"> | boolean
    returnedOk?: BoolFilter<"OrderItem"> | boolean
    takenDate?: DateTimeNullableFilter<"OrderItem"> | Date | string | null
    returnDate?: DateTimeNullableFilter<"OrderItem"> | Date | string | null
    isDeleted?: BoolFilter<"OrderItem"> | boolean
    deletedAt?: DateTimeNullableFilter<"OrderItem"> | Date | string | null
    neckAlteration?: IntNullableFilter<"OrderItem"> | number | null
    lengthAlteration?: StringNullableFilter<"OrderItem"> | string | null
    sleeveAlteration?: IntNullableFilter<"OrderItem"> | number | null
    alterationDetails?: StringNullableFilter<"OrderItem"> | string | null
    alterationDone?: BoolFilter<"OrderItem"> | boolean
    order?: XOR<OrderNullableRelationFilter, OrderWhereInput> | null
    dressItem?: XOR<DressItemNullableRelationFilter, DressItemWhereInput> | null
  }, "id">

  export type OrderItemOrderByWithAggregationInput = {
    id?: SortOrder
    orderId?: SortOrderInput | SortOrder
    dressItemId?: SortOrderInput | SortOrder
    price?: SortOrderInput | SortOrder
    quantity?: SortOrderInput | SortOrder
    description?: SortOrderInput | SortOrder
    sizeText?: SortOrderInput | SortOrder
    repairs?: SortOrderInput | SortOrder
    basePrice?: SortOrderInput | SortOrder
    finalPrice?: SortOrderInput | SortOrder
    barcode?: SortOrderInput | SortOrder
    barcodePrefix?: SortOrderInput | SortOrder
    size?: SortOrderInput | SortOrder
    isTaken?: SortOrder
    isReturned?: SortOrder
    returnedOk?: SortOrder
    takenDate?: SortOrderInput | SortOrder
    returnDate?: SortOrderInput | SortOrder
    isDeleted?: SortOrder
    deletedAt?: SortOrderInput | SortOrder
    neckAlteration?: SortOrderInput | SortOrder
    lengthAlteration?: SortOrderInput | SortOrder
    sleeveAlteration?: SortOrderInput | SortOrder
    alterationDetails?: SortOrderInput | SortOrder
    alterationDone?: SortOrder
    _count?: OrderItemCountOrderByAggregateInput
    _avg?: OrderItemAvgOrderByAggregateInput
    _max?: OrderItemMaxOrderByAggregateInput
    _min?: OrderItemMinOrderByAggregateInput
    _sum?: OrderItemSumOrderByAggregateInput
  }

  export type OrderItemScalarWhereWithAggregatesInput = {
    AND?: OrderItemScalarWhereWithAggregatesInput | OrderItemScalarWhereWithAggregatesInput[]
    OR?: OrderItemScalarWhereWithAggregatesInput[]
    NOT?: OrderItemScalarWhereWithAggregatesInput | OrderItemScalarWhereWithAggregatesInput[]
    id?: IntWithAggregatesFilter<"OrderItem"> | number
    orderId?: IntNullableWithAggregatesFilter<"OrderItem"> | number | null
    dressItemId?: IntNullableWithAggregatesFilter<"OrderItem"> | number | null
    price?: FloatNullableWithAggregatesFilter<"OrderItem"> | number | null
    quantity?: IntNullableWithAggregatesFilter<"OrderItem"> | number | null
    description?: StringNullableWithAggregatesFilter<"OrderItem"> | string | null
    sizeText?: StringNullableWithAggregatesFilter<"OrderItem"> | string | null
    repairs?: StringNullableWithAggregatesFilter<"OrderItem"> | string | null
    basePrice?: FloatNullableWithAggregatesFilter<"OrderItem"> | number | null
    finalPrice?: FloatNullableWithAggregatesFilter<"OrderItem"> | number | null
    barcode?: StringNullableWithAggregatesFilter<"OrderItem"> | string | null
    barcodePrefix?: IntNullableWithAggregatesFilter<"OrderItem"> | number | null
    size?: StringNullableWithAggregatesFilter<"OrderItem"> | string | null
    isTaken?: BoolWithAggregatesFilter<"OrderItem"> | boolean
    isReturned?: BoolWithAggregatesFilter<"OrderItem"> | boolean
    returnedOk?: BoolWithAggregatesFilter<"OrderItem"> | boolean
    takenDate?: DateTimeNullableWithAggregatesFilter<"OrderItem"> | Date | string | null
    returnDate?: DateTimeNullableWithAggregatesFilter<"OrderItem"> | Date | string | null
    isDeleted?: BoolWithAggregatesFilter<"OrderItem"> | boolean
    deletedAt?: DateTimeNullableWithAggregatesFilter<"OrderItem"> | Date | string | null
    neckAlteration?: IntNullableWithAggregatesFilter<"OrderItem"> | number | null
    lengthAlteration?: StringNullableWithAggregatesFilter<"OrderItem"> | string | null
    sleeveAlteration?: IntNullableWithAggregatesFilter<"OrderItem"> | number | null
    alterationDetails?: StringNullableWithAggregatesFilter<"OrderItem"> | string | null
    alterationDone?: BoolWithAggregatesFilter<"OrderItem"> | boolean
  }

  export type PriceListWhereInput = {
    AND?: PriceListWhereInput | PriceListWhereInput[]
    OR?: PriceListWhereInput[]
    NOT?: PriceListWhereInput | PriceListWhereInput[]
    id?: IntFilter<"PriceList"> | number
    description?: StringNullableFilter<"PriceList"> | string | null
    fromSize?: IntNullableFilter<"PriceList"> | number | null
    toSize?: IntNullableFilter<"PriceList"> | number | null
    price?: FloatNullableFilter<"PriceList"> | number | null
    startDate?: DateTimeNullableFilter<"PriceList"> | Date | string | null
    endDate?: DateTimeNullableFilter<"PriceList"> | Date | string | null
    category?: StringNullableFilter<"PriceList"> | string | null
    deposit?: FloatNullableFilter<"PriceList"> | number | null
  }

  export type PriceListOrderByWithRelationInput = {
    id?: SortOrder
    description?: SortOrderInput | SortOrder
    fromSize?: SortOrderInput | SortOrder
    toSize?: SortOrderInput | SortOrder
    price?: SortOrderInput | SortOrder
    startDate?: SortOrderInput | SortOrder
    endDate?: SortOrderInput | SortOrder
    category?: SortOrderInput | SortOrder
    deposit?: SortOrderInput | SortOrder
  }

  export type PriceListWhereUniqueInput = Prisma.AtLeast<{
    id?: number
    AND?: PriceListWhereInput | PriceListWhereInput[]
    OR?: PriceListWhereInput[]
    NOT?: PriceListWhereInput | PriceListWhereInput[]
    description?: StringNullableFilter<"PriceList"> | string | null
    fromSize?: IntNullableFilter<"PriceList"> | number | null
    toSize?: IntNullableFilter<"PriceList"> | number | null
    price?: FloatNullableFilter<"PriceList"> | number | null
    startDate?: DateTimeNullableFilter<"PriceList"> | Date | string | null
    endDate?: DateTimeNullableFilter<"PriceList"> | Date | string | null
    category?: StringNullableFilter<"PriceList"> | string | null
    deposit?: FloatNullableFilter<"PriceList"> | number | null
  }, "id">

  export type PriceListOrderByWithAggregationInput = {
    id?: SortOrder
    description?: SortOrderInput | SortOrder
    fromSize?: SortOrderInput | SortOrder
    toSize?: SortOrderInput | SortOrder
    price?: SortOrderInput | SortOrder
    startDate?: SortOrderInput | SortOrder
    endDate?: SortOrderInput | SortOrder
    category?: SortOrderInput | SortOrder
    deposit?: SortOrderInput | SortOrder
    _count?: PriceListCountOrderByAggregateInput
    _avg?: PriceListAvgOrderByAggregateInput
    _max?: PriceListMaxOrderByAggregateInput
    _min?: PriceListMinOrderByAggregateInput
    _sum?: PriceListSumOrderByAggregateInput
  }

  export type PriceListScalarWhereWithAggregatesInput = {
    AND?: PriceListScalarWhereWithAggregatesInput | PriceListScalarWhereWithAggregatesInput[]
    OR?: PriceListScalarWhereWithAggregatesInput[]
    NOT?: PriceListScalarWhereWithAggregatesInput | PriceListScalarWhereWithAggregatesInput[]
    id?: IntWithAggregatesFilter<"PriceList"> | number
    description?: StringNullableWithAggregatesFilter<"PriceList"> | string | null
    fromSize?: IntNullableWithAggregatesFilter<"PriceList"> | number | null
    toSize?: IntNullableWithAggregatesFilter<"PriceList"> | number | null
    price?: FloatNullableWithAggregatesFilter<"PriceList"> | number | null
    startDate?: DateTimeNullableWithAggregatesFilter<"PriceList"> | Date | string | null
    endDate?: DateTimeNullableWithAggregatesFilter<"PriceList"> | Date | string | null
    category?: StringNullableWithAggregatesFilter<"PriceList"> | string | null
    deposit?: FloatNullableWithAggregatesFilter<"PriceList"> | number | null
  }

  export type SystemSettingWhereInput = {
    AND?: SystemSettingWhereInput | SystemSettingWhereInput[]
    OR?: SystemSettingWhereInput[]
    NOT?: SystemSettingWhereInput | SystemSettingWhereInput[]
    id?: IntFilter<"SystemSetting"> | number
    key?: StringFilter<"SystemSetting"> | string
    value?: StringNullableFilter<"SystemSetting"> | string | null
    name?: StringNullableFilter<"SystemSetting"> | string | null
    category?: StringNullableFilter<"SystemSetting"> | string | null
    notes?: StringNullableFilter<"SystemSetting"> | string | null
    type?: StringFilter<"SystemSetting"> | string
  }

  export type SystemSettingOrderByWithRelationInput = {
    id?: SortOrder
    key?: SortOrder
    value?: SortOrderInput | SortOrder
    name?: SortOrderInput | SortOrder
    category?: SortOrderInput | SortOrder
    notes?: SortOrderInput | SortOrder
    type?: SortOrder
  }

  export type SystemSettingWhereUniqueInput = Prisma.AtLeast<{
    id?: number
    key?: string
    AND?: SystemSettingWhereInput | SystemSettingWhereInput[]
    OR?: SystemSettingWhereInput[]
    NOT?: SystemSettingWhereInput | SystemSettingWhereInput[]
    value?: StringNullableFilter<"SystemSetting"> | string | null
    name?: StringNullableFilter<"SystemSetting"> | string | null
    category?: StringNullableFilter<"SystemSetting"> | string | null
    notes?: StringNullableFilter<"SystemSetting"> | string | null
    type?: StringFilter<"SystemSetting"> | string
  }, "id" | "key">

  export type SystemSettingOrderByWithAggregationInput = {
    id?: SortOrder
    key?: SortOrder
    value?: SortOrderInput | SortOrder
    name?: SortOrderInput | SortOrder
    category?: SortOrderInput | SortOrder
    notes?: SortOrderInput | SortOrder
    type?: SortOrder
    _count?: SystemSettingCountOrderByAggregateInput
    _avg?: SystemSettingAvgOrderByAggregateInput
    _max?: SystemSettingMaxOrderByAggregateInput
    _min?: SystemSettingMinOrderByAggregateInput
    _sum?: SystemSettingSumOrderByAggregateInput
  }

  export type SystemSettingScalarWhereWithAggregatesInput = {
    AND?: SystemSettingScalarWhereWithAggregatesInput | SystemSettingScalarWhereWithAggregatesInput[]
    OR?: SystemSettingScalarWhereWithAggregatesInput[]
    NOT?: SystemSettingScalarWhereWithAggregatesInput | SystemSettingScalarWhereWithAggregatesInput[]
    id?: IntWithAggregatesFilter<"SystemSetting"> | number
    key?: StringWithAggregatesFilter<"SystemSetting"> | string
    value?: StringNullableWithAggregatesFilter<"SystemSetting"> | string | null
    name?: StringNullableWithAggregatesFilter<"SystemSetting"> | string | null
    category?: StringNullableWithAggregatesFilter<"SystemSetting"> | string | null
    notes?: StringNullableWithAggregatesFilter<"SystemSetting"> | string | null
    type?: StringWithAggregatesFilter<"SystemSetting"> | string
  }

  export type PriceRuleWhereInput = {
    AND?: PriceRuleWhereInput | PriceRuleWhereInput[]
    OR?: PriceRuleWhereInput[]
    NOT?: PriceRuleWhereInput | PriceRuleWhereInput[]
    id?: IntFilter<"PriceRule"> | number
    description?: StringNullableFilter<"PriceRule"> | string | null
    minSize?: IntNullableFilter<"PriceRule"> | number | null
    maxSize?: IntNullableFilter<"PriceRule"> | number | null
    price?: FloatNullableFilter<"PriceRule"> | number | null
    startDate?: DateTimeNullableFilter<"PriceRule"> | Date | string | null
    endDate?: DateTimeNullableFilter<"PriceRule"> | Date | string | null
    category?: StringNullableFilter<"PriceRule"> | string | null
    refund?: FloatNullableFilter<"PriceRule"> | number | null
  }

  export type PriceRuleOrderByWithRelationInput = {
    id?: SortOrder
    description?: SortOrderInput | SortOrder
    minSize?: SortOrderInput | SortOrder
    maxSize?: SortOrderInput | SortOrder
    price?: SortOrderInput | SortOrder
    startDate?: SortOrderInput | SortOrder
    endDate?: SortOrderInput | SortOrder
    category?: SortOrderInput | SortOrder
    refund?: SortOrderInput | SortOrder
  }

  export type PriceRuleWhereUniqueInput = Prisma.AtLeast<{
    id?: number
    AND?: PriceRuleWhereInput | PriceRuleWhereInput[]
    OR?: PriceRuleWhereInput[]
    NOT?: PriceRuleWhereInput | PriceRuleWhereInput[]
    description?: StringNullableFilter<"PriceRule"> | string | null
    minSize?: IntNullableFilter<"PriceRule"> | number | null
    maxSize?: IntNullableFilter<"PriceRule"> | number | null
    price?: FloatNullableFilter<"PriceRule"> | number | null
    startDate?: DateTimeNullableFilter<"PriceRule"> | Date | string | null
    endDate?: DateTimeNullableFilter<"PriceRule"> | Date | string | null
    category?: StringNullableFilter<"PriceRule"> | string | null
    refund?: FloatNullableFilter<"PriceRule"> | number | null
  }, "id">

  export type PriceRuleOrderByWithAggregationInput = {
    id?: SortOrder
    description?: SortOrderInput | SortOrder
    minSize?: SortOrderInput | SortOrder
    maxSize?: SortOrderInput | SortOrder
    price?: SortOrderInput | SortOrder
    startDate?: SortOrderInput | SortOrder
    endDate?: SortOrderInput | SortOrder
    category?: SortOrderInput | SortOrder
    refund?: SortOrderInput | SortOrder
    _count?: PriceRuleCountOrderByAggregateInput
    _avg?: PriceRuleAvgOrderByAggregateInput
    _max?: PriceRuleMaxOrderByAggregateInput
    _min?: PriceRuleMinOrderByAggregateInput
    _sum?: PriceRuleSumOrderByAggregateInput
  }

  export type PriceRuleScalarWhereWithAggregatesInput = {
    AND?: PriceRuleScalarWhereWithAggregatesInput | PriceRuleScalarWhereWithAggregatesInput[]
    OR?: PriceRuleScalarWhereWithAggregatesInput[]
    NOT?: PriceRuleScalarWhereWithAggregatesInput | PriceRuleScalarWhereWithAggregatesInput[]
    id?: IntWithAggregatesFilter<"PriceRule"> | number
    description?: StringNullableWithAggregatesFilter<"PriceRule"> | string | null
    minSize?: IntNullableWithAggregatesFilter<"PriceRule"> | number | null
    maxSize?: IntNullableWithAggregatesFilter<"PriceRule"> | number | null
    price?: FloatNullableWithAggregatesFilter<"PriceRule"> | number | null
    startDate?: DateTimeNullableWithAggregatesFilter<"PriceRule"> | Date | string | null
    endDate?: DateTimeNullableWithAggregatesFilter<"PriceRule"> | Date | string | null
    category?: StringNullableWithAggregatesFilter<"PriceRule"> | string | null
    refund?: FloatNullableWithAggregatesFilter<"PriceRule"> | number | null
  }

  export type PageVisitLogWhereInput = {
    AND?: PageVisitLogWhereInput | PageVisitLogWhereInput[]
    OR?: PageVisitLogWhereInput[]
    NOT?: PageVisitLogWhereInput | PageVisitLogWhereInput[]
    id?: IntFilter<"PageVisitLog"> | number
    pageUrl?: StringFilter<"PageVisitLog"> | string
    employeeId?: IntNullableFilter<"PageVisitLog"> | number | null
    employeeName?: StringNullableFilter<"PageVisitLog"> | string | null
    timestamp?: DateTimeFilter<"PageVisitLog"> | Date | string
    loadingError?: StringNullableFilter<"PageVisitLog"> | string | null
    isGuest?: BoolFilter<"PageVisitLog"> | boolean
    employee?: XOR<EmployeeNullableRelationFilter, EmployeeWhereInput> | null
  }

  export type PageVisitLogOrderByWithRelationInput = {
    id?: SortOrder
    pageUrl?: SortOrder
    employeeId?: SortOrderInput | SortOrder
    employeeName?: SortOrderInput | SortOrder
    timestamp?: SortOrder
    loadingError?: SortOrderInput | SortOrder
    isGuest?: SortOrder
    employee?: EmployeeOrderByWithRelationInput
  }

  export type PageVisitLogWhereUniqueInput = Prisma.AtLeast<{
    id?: number
    AND?: PageVisitLogWhereInput | PageVisitLogWhereInput[]
    OR?: PageVisitLogWhereInput[]
    NOT?: PageVisitLogWhereInput | PageVisitLogWhereInput[]
    pageUrl?: StringFilter<"PageVisitLog"> | string
    employeeId?: IntNullableFilter<"PageVisitLog"> | number | null
    employeeName?: StringNullableFilter<"PageVisitLog"> | string | null
    timestamp?: DateTimeFilter<"PageVisitLog"> | Date | string
    loadingError?: StringNullableFilter<"PageVisitLog"> | string | null
    isGuest?: BoolFilter<"PageVisitLog"> | boolean
    employee?: XOR<EmployeeNullableRelationFilter, EmployeeWhereInput> | null
  }, "id">

  export type PageVisitLogOrderByWithAggregationInput = {
    id?: SortOrder
    pageUrl?: SortOrder
    employeeId?: SortOrderInput | SortOrder
    employeeName?: SortOrderInput | SortOrder
    timestamp?: SortOrder
    loadingError?: SortOrderInput | SortOrder
    isGuest?: SortOrder
    _count?: PageVisitLogCountOrderByAggregateInput
    _avg?: PageVisitLogAvgOrderByAggregateInput
    _max?: PageVisitLogMaxOrderByAggregateInput
    _min?: PageVisitLogMinOrderByAggregateInput
    _sum?: PageVisitLogSumOrderByAggregateInput
  }

  export type PageVisitLogScalarWhereWithAggregatesInput = {
    AND?: PageVisitLogScalarWhereWithAggregatesInput | PageVisitLogScalarWhereWithAggregatesInput[]
    OR?: PageVisitLogScalarWhereWithAggregatesInput[]
    NOT?: PageVisitLogScalarWhereWithAggregatesInput | PageVisitLogScalarWhereWithAggregatesInput[]
    id?: IntWithAggregatesFilter<"PageVisitLog"> | number
    pageUrl?: StringWithAggregatesFilter<"PageVisitLog"> | string
    employeeId?: IntNullableWithAggregatesFilter<"PageVisitLog"> | number | null
    employeeName?: StringNullableWithAggregatesFilter<"PageVisitLog"> | string | null
    timestamp?: DateTimeWithAggregatesFilter<"PageVisitLog"> | Date | string
    loadingError?: StringNullableWithAggregatesFilter<"PageVisitLog"> | string | null
    isGuest?: BoolWithAggregatesFilter<"PageVisitLog"> | boolean
  }

  export type EmailLogWhereInput = {
    AND?: EmailLogWhereInput | EmailLogWhereInput[]
    OR?: EmailLogWhereInput[]
    NOT?: EmailLogWhereInput | EmailLogWhereInput[]
    id?: IntFilter<"EmailLog"> | number
    to?: StringFilter<"EmailLog"> | string
    cc?: StringNullableFilter<"EmailLog"> | string | null
    subject?: StringNullableFilter<"EmailLog"> | string | null
    body?: StringNullableFilter<"EmailLog"> | string | null
    fileName?: StringNullableFilter<"EmailLog"> | string | null
    status?: StringFilter<"EmailLog"> | string
    errorMessage?: StringNullableFilter<"EmailLog"> | string | null
    customerId?: IntNullableFilter<"EmailLog"> | number | null
    employeeId?: IntNullableFilter<"EmailLog"> | number | null
    sentAt?: DateTimeFilter<"EmailLog"> | Date | string
  }

  export type EmailLogOrderByWithRelationInput = {
    id?: SortOrder
    to?: SortOrder
    cc?: SortOrderInput | SortOrder
    subject?: SortOrderInput | SortOrder
    body?: SortOrderInput | SortOrder
    fileName?: SortOrderInput | SortOrder
    status?: SortOrder
    errorMessage?: SortOrderInput | SortOrder
    customerId?: SortOrderInput | SortOrder
    employeeId?: SortOrderInput | SortOrder
    sentAt?: SortOrder
  }

  export type EmailLogWhereUniqueInput = Prisma.AtLeast<{
    id?: number
    AND?: EmailLogWhereInput | EmailLogWhereInput[]
    OR?: EmailLogWhereInput[]
    NOT?: EmailLogWhereInput | EmailLogWhereInput[]
    to?: StringFilter<"EmailLog"> | string
    cc?: StringNullableFilter<"EmailLog"> | string | null
    subject?: StringNullableFilter<"EmailLog"> | string | null
    body?: StringNullableFilter<"EmailLog"> | string | null
    fileName?: StringNullableFilter<"EmailLog"> | string | null
    status?: StringFilter<"EmailLog"> | string
    errorMessage?: StringNullableFilter<"EmailLog"> | string | null
    customerId?: IntNullableFilter<"EmailLog"> | number | null
    employeeId?: IntNullableFilter<"EmailLog"> | number | null
    sentAt?: DateTimeFilter<"EmailLog"> | Date | string
  }, "id">

  export type EmailLogOrderByWithAggregationInput = {
    id?: SortOrder
    to?: SortOrder
    cc?: SortOrderInput | SortOrder
    subject?: SortOrderInput | SortOrder
    body?: SortOrderInput | SortOrder
    fileName?: SortOrderInput | SortOrder
    status?: SortOrder
    errorMessage?: SortOrderInput | SortOrder
    customerId?: SortOrderInput | SortOrder
    employeeId?: SortOrderInput | SortOrder
    sentAt?: SortOrder
    _count?: EmailLogCountOrderByAggregateInput
    _avg?: EmailLogAvgOrderByAggregateInput
    _max?: EmailLogMaxOrderByAggregateInput
    _min?: EmailLogMinOrderByAggregateInput
    _sum?: EmailLogSumOrderByAggregateInput
  }

  export type EmailLogScalarWhereWithAggregatesInput = {
    AND?: EmailLogScalarWhereWithAggregatesInput | EmailLogScalarWhereWithAggregatesInput[]
    OR?: EmailLogScalarWhereWithAggregatesInput[]
    NOT?: EmailLogScalarWhereWithAggregatesInput | EmailLogScalarWhereWithAggregatesInput[]
    id?: IntWithAggregatesFilter<"EmailLog"> | number
    to?: StringWithAggregatesFilter<"EmailLog"> | string
    cc?: StringNullableWithAggregatesFilter<"EmailLog"> | string | null
    subject?: StringNullableWithAggregatesFilter<"EmailLog"> | string | null
    body?: StringNullableWithAggregatesFilter<"EmailLog"> | string | null
    fileName?: StringNullableWithAggregatesFilter<"EmailLog"> | string | null
    status?: StringWithAggregatesFilter<"EmailLog"> | string
    errorMessage?: StringNullableWithAggregatesFilter<"EmailLog"> | string | null
    customerId?: IntNullableWithAggregatesFilter<"EmailLog"> | number | null
    employeeId?: IntNullableWithAggregatesFilter<"EmailLog"> | number | null
    sentAt?: DateTimeWithAggregatesFilter<"EmailLog"> | Date | string
  }

  export type CustomerCreateInput = {
    firstName?: string | null
    lastName?: string | null
    phone1?: string | null
    phone2?: string | null
    city?: string | null
    street?: string | null
    houseNum?: number | null
    email?: string | null
    emailSuffix?: string | null
    notes?: string | null
    registrationDate?: string | null
    officeNotes?: string | null
    isDeleted?: boolean
    orders?: OrderCreateNestedManyWithoutCustomerInput
    payments?: PaymentCreateNestedManyWithoutCustomerInput
  }

  export type CustomerUncheckedCreateInput = {
    id?: number
    firstName?: string | null
    lastName?: string | null
    phone1?: string | null
    phone2?: string | null
    city?: string | null
    street?: string | null
    houseNum?: number | null
    email?: string | null
    emailSuffix?: string | null
    notes?: string | null
    registrationDate?: string | null
    officeNotes?: string | null
    isDeleted?: boolean
    orders?: OrderUncheckedCreateNestedManyWithoutCustomerInput
    payments?: PaymentUncheckedCreateNestedManyWithoutCustomerInput
  }

  export type CustomerUpdateInput = {
    firstName?: NullableStringFieldUpdateOperationsInput | string | null
    lastName?: NullableStringFieldUpdateOperationsInput | string | null
    phone1?: NullableStringFieldUpdateOperationsInput | string | null
    phone2?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    street?: NullableStringFieldUpdateOperationsInput | string | null
    houseNum?: NullableIntFieldUpdateOperationsInput | number | null
    email?: NullableStringFieldUpdateOperationsInput | string | null
    emailSuffix?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    registrationDate?: NullableStringFieldUpdateOperationsInput | string | null
    officeNotes?: NullableStringFieldUpdateOperationsInput | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    orders?: OrderUpdateManyWithoutCustomerNestedInput
    payments?: PaymentUpdateManyWithoutCustomerNestedInput
  }

  export type CustomerUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number
    firstName?: NullableStringFieldUpdateOperationsInput | string | null
    lastName?: NullableStringFieldUpdateOperationsInput | string | null
    phone1?: NullableStringFieldUpdateOperationsInput | string | null
    phone2?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    street?: NullableStringFieldUpdateOperationsInput | string | null
    houseNum?: NullableIntFieldUpdateOperationsInput | number | null
    email?: NullableStringFieldUpdateOperationsInput | string | null
    emailSuffix?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    registrationDate?: NullableStringFieldUpdateOperationsInput | string | null
    officeNotes?: NullableStringFieldUpdateOperationsInput | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    orders?: OrderUncheckedUpdateManyWithoutCustomerNestedInput
    payments?: PaymentUncheckedUpdateManyWithoutCustomerNestedInput
  }

  export type CustomerCreateManyInput = {
    id?: number
    firstName?: string | null
    lastName?: string | null
    phone1?: string | null
    phone2?: string | null
    city?: string | null
    street?: string | null
    houseNum?: number | null
    email?: string | null
    emailSuffix?: string | null
    notes?: string | null
    registrationDate?: string | null
    officeNotes?: string | null
    isDeleted?: boolean
  }

  export type CustomerUpdateManyMutationInput = {
    firstName?: NullableStringFieldUpdateOperationsInput | string | null
    lastName?: NullableStringFieldUpdateOperationsInput | string | null
    phone1?: NullableStringFieldUpdateOperationsInput | string | null
    phone2?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    street?: NullableStringFieldUpdateOperationsInput | string | null
    houseNum?: NullableIntFieldUpdateOperationsInput | number | null
    email?: NullableStringFieldUpdateOperationsInput | string | null
    emailSuffix?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    registrationDate?: NullableStringFieldUpdateOperationsInput | string | null
    officeNotes?: NullableStringFieldUpdateOperationsInput | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
  }

  export type CustomerUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number
    firstName?: NullableStringFieldUpdateOperationsInput | string | null
    lastName?: NullableStringFieldUpdateOperationsInput | string | null
    phone1?: NullableStringFieldUpdateOperationsInput | string | null
    phone2?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    street?: NullableStringFieldUpdateOperationsInput | string | null
    houseNum?: NullableIntFieldUpdateOperationsInput | number | null
    email?: NullableStringFieldUpdateOperationsInput | string | null
    emailSuffix?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    registrationDate?: NullableStringFieldUpdateOperationsInput | string | null
    officeNotes?: NullableStringFieldUpdateOperationsInput | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
  }

  export type AuditLogCreateInput = {
    entityType: string
    entityId: number
    action: string
    changesJson: string
    createdAt?: Date | string
    employeeId?: number | null
  }

  export type AuditLogUncheckedCreateInput = {
    id?: number
    entityType: string
    entityId: number
    action: string
    changesJson: string
    createdAt?: Date | string
    employeeId?: number | null
  }

  export type AuditLogUpdateInput = {
    entityType?: StringFieldUpdateOperationsInput | string
    entityId?: IntFieldUpdateOperationsInput | number
    action?: StringFieldUpdateOperationsInput | string
    changesJson?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    employeeId?: NullableIntFieldUpdateOperationsInput | number | null
  }

  export type AuditLogUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number
    entityType?: StringFieldUpdateOperationsInput | string
    entityId?: IntFieldUpdateOperationsInput | number
    action?: StringFieldUpdateOperationsInput | string
    changesJson?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    employeeId?: NullableIntFieldUpdateOperationsInput | number | null
  }

  export type AuditLogCreateManyInput = {
    id?: number
    entityType: string
    entityId: number
    action: string
    changesJson: string
    createdAt?: Date | string
    employeeId?: number | null
  }

  export type AuditLogUpdateManyMutationInput = {
    entityType?: StringFieldUpdateOperationsInput | string
    entityId?: IntFieldUpdateOperationsInput | number
    action?: StringFieldUpdateOperationsInput | string
    changesJson?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    employeeId?: NullableIntFieldUpdateOperationsInput | number | null
  }

  export type AuditLogUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number
    entityType?: StringFieldUpdateOperationsInput | string
    entityId?: IntFieldUpdateOperationsInput | number
    action?: StringFieldUpdateOperationsInput | string
    changesJson?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    employeeId?: NullableIntFieldUpdateOperationsInput | number | null
  }

  export type EmployeeCreateInput = {
    firstName?: string | null
    lastName?: string | null
    phone1?: string | null
    phone2?: string | null
    city?: string | null
    street?: string | null
    houseNum?: string | null
    email?: string | null
    joinDate?: Date | string | null
    fullName?: string | null
    notes?: string | null
    emailSuffix?: string | null
    roleId?: number | null
    password?: string | null
    isActive?: boolean
    hourlyWage?: number | null
    paymentMethod?: string | null
    travelExpenses?: boolean | null
    pageVisits?: PageVisitLogCreateNestedManyWithoutEmployeeInput
    shifts?: ShiftCreateNestedManyWithoutEmployeeInput
  }

  export type EmployeeUncheckedCreateInput = {
    id?: number
    firstName?: string | null
    lastName?: string | null
    phone1?: string | null
    phone2?: string | null
    city?: string | null
    street?: string | null
    houseNum?: string | null
    email?: string | null
    joinDate?: Date | string | null
    fullName?: string | null
    notes?: string | null
    emailSuffix?: string | null
    roleId?: number | null
    password?: string | null
    isActive?: boolean
    hourlyWage?: number | null
    paymentMethod?: string | null
    travelExpenses?: boolean | null
    pageVisits?: PageVisitLogUncheckedCreateNestedManyWithoutEmployeeInput
    shifts?: ShiftUncheckedCreateNestedManyWithoutEmployeeInput
  }

  export type EmployeeUpdateInput = {
    firstName?: NullableStringFieldUpdateOperationsInput | string | null
    lastName?: NullableStringFieldUpdateOperationsInput | string | null
    phone1?: NullableStringFieldUpdateOperationsInput | string | null
    phone2?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    street?: NullableStringFieldUpdateOperationsInput | string | null
    houseNum?: NullableStringFieldUpdateOperationsInput | string | null
    email?: NullableStringFieldUpdateOperationsInput | string | null
    joinDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    fullName?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    emailSuffix?: NullableStringFieldUpdateOperationsInput | string | null
    roleId?: NullableIntFieldUpdateOperationsInput | number | null
    password?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    hourlyWage?: NullableFloatFieldUpdateOperationsInput | number | null
    paymentMethod?: NullableStringFieldUpdateOperationsInput | string | null
    travelExpenses?: NullableBoolFieldUpdateOperationsInput | boolean | null
    pageVisits?: PageVisitLogUpdateManyWithoutEmployeeNestedInput
    shifts?: ShiftUpdateManyWithoutEmployeeNestedInput
  }

  export type EmployeeUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number
    firstName?: NullableStringFieldUpdateOperationsInput | string | null
    lastName?: NullableStringFieldUpdateOperationsInput | string | null
    phone1?: NullableStringFieldUpdateOperationsInput | string | null
    phone2?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    street?: NullableStringFieldUpdateOperationsInput | string | null
    houseNum?: NullableStringFieldUpdateOperationsInput | string | null
    email?: NullableStringFieldUpdateOperationsInput | string | null
    joinDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    fullName?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    emailSuffix?: NullableStringFieldUpdateOperationsInput | string | null
    roleId?: NullableIntFieldUpdateOperationsInput | number | null
    password?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    hourlyWage?: NullableFloatFieldUpdateOperationsInput | number | null
    paymentMethod?: NullableStringFieldUpdateOperationsInput | string | null
    travelExpenses?: NullableBoolFieldUpdateOperationsInput | boolean | null
    pageVisits?: PageVisitLogUncheckedUpdateManyWithoutEmployeeNestedInput
    shifts?: ShiftUncheckedUpdateManyWithoutEmployeeNestedInput
  }

  export type EmployeeCreateManyInput = {
    id?: number
    firstName?: string | null
    lastName?: string | null
    phone1?: string | null
    phone2?: string | null
    city?: string | null
    street?: string | null
    houseNum?: string | null
    email?: string | null
    joinDate?: Date | string | null
    fullName?: string | null
    notes?: string | null
    emailSuffix?: string | null
    roleId?: number | null
    password?: string | null
    isActive?: boolean
    hourlyWage?: number | null
    paymentMethod?: string | null
    travelExpenses?: boolean | null
  }

  export type EmployeeUpdateManyMutationInput = {
    firstName?: NullableStringFieldUpdateOperationsInput | string | null
    lastName?: NullableStringFieldUpdateOperationsInput | string | null
    phone1?: NullableStringFieldUpdateOperationsInput | string | null
    phone2?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    street?: NullableStringFieldUpdateOperationsInput | string | null
    houseNum?: NullableStringFieldUpdateOperationsInput | string | null
    email?: NullableStringFieldUpdateOperationsInput | string | null
    joinDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    fullName?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    emailSuffix?: NullableStringFieldUpdateOperationsInput | string | null
    roleId?: NullableIntFieldUpdateOperationsInput | number | null
    password?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    hourlyWage?: NullableFloatFieldUpdateOperationsInput | number | null
    paymentMethod?: NullableStringFieldUpdateOperationsInput | string | null
    travelExpenses?: NullableBoolFieldUpdateOperationsInput | boolean | null
  }

  export type EmployeeUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number
    firstName?: NullableStringFieldUpdateOperationsInput | string | null
    lastName?: NullableStringFieldUpdateOperationsInput | string | null
    phone1?: NullableStringFieldUpdateOperationsInput | string | null
    phone2?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    street?: NullableStringFieldUpdateOperationsInput | string | null
    houseNum?: NullableStringFieldUpdateOperationsInput | string | null
    email?: NullableStringFieldUpdateOperationsInput | string | null
    joinDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    fullName?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    emailSuffix?: NullableStringFieldUpdateOperationsInput | string | null
    roleId?: NullableIntFieldUpdateOperationsInput | number | null
    password?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    hourlyWage?: NullableFloatFieldUpdateOperationsInput | number | null
    paymentMethod?: NullableStringFieldUpdateOperationsInput | string | null
    travelExpenses?: NullableBoolFieldUpdateOperationsInput | boolean | null
  }

  export type ShiftCreateInput = {
    entryTime?: Date | string | null
    exitTime?: Date | string | null
    hebrewDate?: string | null
    date?: Date | string | null
    totalMinutes?: number | null
    hourlyWageSnapshot?: number | null
    travelExpensesSnapshot?: number | null
    totalCalculated?: number | null
    paymentMethod?: string | null
    notes?: string | null
    isDeleted?: boolean
    employee: EmployeeCreateNestedOneWithoutShiftsInput
  }

  export type ShiftUncheckedCreateInput = {
    id?: number
    employeeId: number
    entryTime?: Date | string | null
    exitTime?: Date | string | null
    hebrewDate?: string | null
    date?: Date | string | null
    totalMinutes?: number | null
    hourlyWageSnapshot?: number | null
    travelExpensesSnapshot?: number | null
    totalCalculated?: number | null
    paymentMethod?: string | null
    notes?: string | null
    isDeleted?: boolean
  }

  export type ShiftUpdateInput = {
    entryTime?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    exitTime?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    hebrewDate?: NullableStringFieldUpdateOperationsInput | string | null
    date?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    totalMinutes?: NullableIntFieldUpdateOperationsInput | number | null
    hourlyWageSnapshot?: NullableFloatFieldUpdateOperationsInput | number | null
    travelExpensesSnapshot?: NullableFloatFieldUpdateOperationsInput | number | null
    totalCalculated?: NullableFloatFieldUpdateOperationsInput | number | null
    paymentMethod?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    employee?: EmployeeUpdateOneRequiredWithoutShiftsNestedInput
  }

  export type ShiftUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number
    employeeId?: IntFieldUpdateOperationsInput | number
    entryTime?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    exitTime?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    hebrewDate?: NullableStringFieldUpdateOperationsInput | string | null
    date?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    totalMinutes?: NullableIntFieldUpdateOperationsInput | number | null
    hourlyWageSnapshot?: NullableFloatFieldUpdateOperationsInput | number | null
    travelExpensesSnapshot?: NullableFloatFieldUpdateOperationsInput | number | null
    totalCalculated?: NullableFloatFieldUpdateOperationsInput | number | null
    paymentMethod?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
  }

  export type ShiftCreateManyInput = {
    id?: number
    employeeId: number
    entryTime?: Date | string | null
    exitTime?: Date | string | null
    hebrewDate?: string | null
    date?: Date | string | null
    totalMinutes?: number | null
    hourlyWageSnapshot?: number | null
    travelExpensesSnapshot?: number | null
    totalCalculated?: number | null
    paymentMethod?: string | null
    notes?: string | null
    isDeleted?: boolean
  }

  export type ShiftUpdateManyMutationInput = {
    entryTime?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    exitTime?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    hebrewDate?: NullableStringFieldUpdateOperationsInput | string | null
    date?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    totalMinutes?: NullableIntFieldUpdateOperationsInput | number | null
    hourlyWageSnapshot?: NullableFloatFieldUpdateOperationsInput | number | null
    travelExpensesSnapshot?: NullableFloatFieldUpdateOperationsInput | number | null
    totalCalculated?: NullableFloatFieldUpdateOperationsInput | number | null
    paymentMethod?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
  }

  export type ShiftUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number
    employeeId?: IntFieldUpdateOperationsInput | number
    entryTime?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    exitTime?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    hebrewDate?: NullableStringFieldUpdateOperationsInput | string | null
    date?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    totalMinutes?: NullableIntFieldUpdateOperationsInput | number | null
    hourlyWageSnapshot?: NullableFloatFieldUpdateOperationsInput | number | null
    travelExpensesSnapshot?: NullableFloatFieldUpdateOperationsInput | number | null
    totalCalculated?: NullableFloatFieldUpdateOperationsInput | number | null
    paymentMethod?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
  }

  export type DressModelCreateInput = {
    name?: string | null
    barcodePrefix?: number | null
    priceCategory?: string | null
    notes?: string | null
    inInspection?: boolean
    imageUrl?: string | null
    entryDateToRepo?: Date | string | null
    exitDateFromRepo?: Date | string | null
    isDeleted?: boolean
    deletedAt?: Date | string | null
    items?: DressItemCreateNestedManyWithoutDressInput
  }

  export type DressModelUncheckedCreateInput = {
    id?: number
    name?: string | null
    barcodePrefix?: number | null
    priceCategory?: string | null
    notes?: string | null
    inInspection?: boolean
    imageUrl?: string | null
    entryDateToRepo?: Date | string | null
    exitDateFromRepo?: Date | string | null
    isDeleted?: boolean
    deletedAt?: Date | string | null
    items?: DressItemUncheckedCreateNestedManyWithoutDressInput
  }

  export type DressModelUpdateInput = {
    name?: NullableStringFieldUpdateOperationsInput | string | null
    barcodePrefix?: NullableIntFieldUpdateOperationsInput | number | null
    priceCategory?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    inInspection?: BoolFieldUpdateOperationsInput | boolean
    imageUrl?: NullableStringFieldUpdateOperationsInput | string | null
    entryDateToRepo?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    exitDateFromRepo?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    items?: DressItemUpdateManyWithoutDressNestedInput
  }

  export type DressModelUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number
    name?: NullableStringFieldUpdateOperationsInput | string | null
    barcodePrefix?: NullableIntFieldUpdateOperationsInput | number | null
    priceCategory?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    inInspection?: BoolFieldUpdateOperationsInput | boolean
    imageUrl?: NullableStringFieldUpdateOperationsInput | string | null
    entryDateToRepo?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    exitDateFromRepo?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    items?: DressItemUncheckedUpdateManyWithoutDressNestedInput
  }

  export type DressModelCreateManyInput = {
    id?: number
    name?: string | null
    barcodePrefix?: number | null
    priceCategory?: string | null
    notes?: string | null
    inInspection?: boolean
    imageUrl?: string | null
    entryDateToRepo?: Date | string | null
    exitDateFromRepo?: Date | string | null
    isDeleted?: boolean
    deletedAt?: Date | string | null
  }

  export type DressModelUpdateManyMutationInput = {
    name?: NullableStringFieldUpdateOperationsInput | string | null
    barcodePrefix?: NullableIntFieldUpdateOperationsInput | number | null
    priceCategory?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    inInspection?: BoolFieldUpdateOperationsInput | boolean
    imageUrl?: NullableStringFieldUpdateOperationsInput | string | null
    entryDateToRepo?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    exitDateFromRepo?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type DressModelUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number
    name?: NullableStringFieldUpdateOperationsInput | string | null
    barcodePrefix?: NullableIntFieldUpdateOperationsInput | number | null
    priceCategory?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    inInspection?: BoolFieldUpdateOperationsInput | boolean
    imageUrl?: NullableStringFieldUpdateOperationsInput | string | null
    entryDateToRepo?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    exitDateFromRepo?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type DressItemCreateInput = {
    barcodePrefix?: number | null
    dressName?: string | null
    sizeText?: string | null
    serialNumber?: number | null
    dressBarcode?: string | null
    location?: string | null
    locationNum?: number | null
    quantity?: number | null
    inRepair?: boolean
    notInUse?: boolean
    notInUseSince?: Date | string | null
    entryDateToRepo?: Date | string | null
    isDeleted?: boolean
    deletedAt?: Date | string | null
    dress?: DressModelCreateNestedOneWithoutItemsInput
    orderItems?: OrderItemCreateNestedManyWithoutDressItemInput
  }

  export type DressItemUncheckedCreateInput = {
    id?: number
    barcodePrefix?: number | null
    dressModelId?: number | null
    dressName?: string | null
    sizeText?: string | null
    serialNumber?: number | null
    dressBarcode?: string | null
    location?: string | null
    locationNum?: number | null
    quantity?: number | null
    inRepair?: boolean
    notInUse?: boolean
    notInUseSince?: Date | string | null
    entryDateToRepo?: Date | string | null
    isDeleted?: boolean
    deletedAt?: Date | string | null
    orderItems?: OrderItemUncheckedCreateNestedManyWithoutDressItemInput
  }

  export type DressItemUpdateInput = {
    barcodePrefix?: NullableIntFieldUpdateOperationsInput | number | null
    dressName?: NullableStringFieldUpdateOperationsInput | string | null
    sizeText?: NullableStringFieldUpdateOperationsInput | string | null
    serialNumber?: NullableIntFieldUpdateOperationsInput | number | null
    dressBarcode?: NullableStringFieldUpdateOperationsInput | string | null
    location?: NullableStringFieldUpdateOperationsInput | string | null
    locationNum?: NullableIntFieldUpdateOperationsInput | number | null
    quantity?: NullableIntFieldUpdateOperationsInput | number | null
    inRepair?: BoolFieldUpdateOperationsInput | boolean
    notInUse?: BoolFieldUpdateOperationsInput | boolean
    notInUseSince?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    entryDateToRepo?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    dress?: DressModelUpdateOneWithoutItemsNestedInput
    orderItems?: OrderItemUpdateManyWithoutDressItemNestedInput
  }

  export type DressItemUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number
    barcodePrefix?: NullableIntFieldUpdateOperationsInput | number | null
    dressModelId?: NullableIntFieldUpdateOperationsInput | number | null
    dressName?: NullableStringFieldUpdateOperationsInput | string | null
    sizeText?: NullableStringFieldUpdateOperationsInput | string | null
    serialNumber?: NullableIntFieldUpdateOperationsInput | number | null
    dressBarcode?: NullableStringFieldUpdateOperationsInput | string | null
    location?: NullableStringFieldUpdateOperationsInput | string | null
    locationNum?: NullableIntFieldUpdateOperationsInput | number | null
    quantity?: NullableIntFieldUpdateOperationsInput | number | null
    inRepair?: BoolFieldUpdateOperationsInput | boolean
    notInUse?: BoolFieldUpdateOperationsInput | boolean
    notInUseSince?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    entryDateToRepo?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    orderItems?: OrderItemUncheckedUpdateManyWithoutDressItemNestedInput
  }

  export type DressItemCreateManyInput = {
    id?: number
    barcodePrefix?: number | null
    dressModelId?: number | null
    dressName?: string | null
    sizeText?: string | null
    serialNumber?: number | null
    dressBarcode?: string | null
    location?: string | null
    locationNum?: number | null
    quantity?: number | null
    inRepair?: boolean
    notInUse?: boolean
    notInUseSince?: Date | string | null
    entryDateToRepo?: Date | string | null
    isDeleted?: boolean
    deletedAt?: Date | string | null
  }

  export type DressItemUpdateManyMutationInput = {
    barcodePrefix?: NullableIntFieldUpdateOperationsInput | number | null
    dressName?: NullableStringFieldUpdateOperationsInput | string | null
    sizeText?: NullableStringFieldUpdateOperationsInput | string | null
    serialNumber?: NullableIntFieldUpdateOperationsInput | number | null
    dressBarcode?: NullableStringFieldUpdateOperationsInput | string | null
    location?: NullableStringFieldUpdateOperationsInput | string | null
    locationNum?: NullableIntFieldUpdateOperationsInput | number | null
    quantity?: NullableIntFieldUpdateOperationsInput | number | null
    inRepair?: BoolFieldUpdateOperationsInput | boolean
    notInUse?: BoolFieldUpdateOperationsInput | boolean
    notInUseSince?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    entryDateToRepo?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type DressItemUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number
    barcodePrefix?: NullableIntFieldUpdateOperationsInput | number | null
    dressModelId?: NullableIntFieldUpdateOperationsInput | number | null
    dressName?: NullableStringFieldUpdateOperationsInput | string | null
    sizeText?: NullableStringFieldUpdateOperationsInput | string | null
    serialNumber?: NullableIntFieldUpdateOperationsInput | number | null
    dressBarcode?: NullableStringFieldUpdateOperationsInput | string | null
    location?: NullableStringFieldUpdateOperationsInput | string | null
    locationNum?: NullableIntFieldUpdateOperationsInput | number | null
    quantity?: NullableIntFieldUpdateOperationsInput | number | null
    inRepair?: BoolFieldUpdateOperationsInput | boolean
    notInUse?: BoolFieldUpdateOperationsInput | boolean
    notInUseSince?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    entryDateToRepo?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type OrderCreateInput = {
    orderId: number
    totalAmount?: number | null
    paymentDate?: Date | string | null
    paymentMethod?: string | null
    status?: string | null
    notes?: string | null
    isPaid?: boolean
    isDeleted?: boolean
    orderNotes?: string | null
    eventDate?: Date | string | null
    eventDateHebrew?: string | null
    returnDate?: Date | string | null
    isWeekdayEvent?: boolean
    orderDate?: Date | string | null
    isAbroad?: boolean
    fromDate?: Date | string | null
    toDate?: Date | string | null
    customer?: CustomerCreateNestedOneWithoutOrdersInput
    items?: OrderItemCreateNestedManyWithoutOrderInput
    payments?: PaymentCreateNestedManyWithoutOrderInput
    obligations?: PaymentObligationCreateNestedManyWithoutOrderInput
  }

  export type OrderUncheckedCreateInput = {
    id?: number
    orderId: number
    customerId?: number | null
    totalAmount?: number | null
    paymentDate?: Date | string | null
    paymentMethod?: string | null
    status?: string | null
    notes?: string | null
    isPaid?: boolean
    isDeleted?: boolean
    orderNotes?: string | null
    eventDate?: Date | string | null
    eventDateHebrew?: string | null
    returnDate?: Date | string | null
    isWeekdayEvent?: boolean
    orderDate?: Date | string | null
    isAbroad?: boolean
    fromDate?: Date | string | null
    toDate?: Date | string | null
    items?: OrderItemUncheckedCreateNestedManyWithoutOrderInput
    payments?: PaymentUncheckedCreateNestedManyWithoutOrderInput
    obligations?: PaymentObligationUncheckedCreateNestedManyWithoutOrderInput
  }

  export type OrderUpdateInput = {
    orderId?: IntFieldUpdateOperationsInput | number
    totalAmount?: NullableFloatFieldUpdateOperationsInput | number | null
    paymentDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    paymentMethod?: NullableStringFieldUpdateOperationsInput | string | null
    status?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    isPaid?: BoolFieldUpdateOperationsInput | boolean
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    orderNotes?: NullableStringFieldUpdateOperationsInput | string | null
    eventDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    eventDateHebrew?: NullableStringFieldUpdateOperationsInput | string | null
    returnDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isWeekdayEvent?: BoolFieldUpdateOperationsInput | boolean
    orderDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isAbroad?: BoolFieldUpdateOperationsInput | boolean
    fromDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    toDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    customer?: CustomerUpdateOneWithoutOrdersNestedInput
    items?: OrderItemUpdateManyWithoutOrderNestedInput
    payments?: PaymentUpdateManyWithoutOrderNestedInput
    obligations?: PaymentObligationUpdateManyWithoutOrderNestedInput
  }

  export type OrderUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number
    orderId?: IntFieldUpdateOperationsInput | number
    customerId?: NullableIntFieldUpdateOperationsInput | number | null
    totalAmount?: NullableFloatFieldUpdateOperationsInput | number | null
    paymentDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    paymentMethod?: NullableStringFieldUpdateOperationsInput | string | null
    status?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    isPaid?: BoolFieldUpdateOperationsInput | boolean
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    orderNotes?: NullableStringFieldUpdateOperationsInput | string | null
    eventDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    eventDateHebrew?: NullableStringFieldUpdateOperationsInput | string | null
    returnDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isWeekdayEvent?: BoolFieldUpdateOperationsInput | boolean
    orderDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isAbroad?: BoolFieldUpdateOperationsInput | boolean
    fromDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    toDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    items?: OrderItemUncheckedUpdateManyWithoutOrderNestedInput
    payments?: PaymentUncheckedUpdateManyWithoutOrderNestedInput
    obligations?: PaymentObligationUncheckedUpdateManyWithoutOrderNestedInput
  }

  export type OrderCreateManyInput = {
    id?: number
    orderId: number
    customerId?: number | null
    totalAmount?: number | null
    paymentDate?: Date | string | null
    paymentMethod?: string | null
    status?: string | null
    notes?: string | null
    isPaid?: boolean
    isDeleted?: boolean
    orderNotes?: string | null
    eventDate?: Date | string | null
    eventDateHebrew?: string | null
    returnDate?: Date | string | null
    isWeekdayEvent?: boolean
    orderDate?: Date | string | null
    isAbroad?: boolean
    fromDate?: Date | string | null
    toDate?: Date | string | null
  }

  export type OrderUpdateManyMutationInput = {
    orderId?: IntFieldUpdateOperationsInput | number
    totalAmount?: NullableFloatFieldUpdateOperationsInput | number | null
    paymentDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    paymentMethod?: NullableStringFieldUpdateOperationsInput | string | null
    status?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    isPaid?: BoolFieldUpdateOperationsInput | boolean
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    orderNotes?: NullableStringFieldUpdateOperationsInput | string | null
    eventDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    eventDateHebrew?: NullableStringFieldUpdateOperationsInput | string | null
    returnDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isWeekdayEvent?: BoolFieldUpdateOperationsInput | boolean
    orderDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isAbroad?: BoolFieldUpdateOperationsInput | boolean
    fromDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    toDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type OrderUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number
    orderId?: IntFieldUpdateOperationsInput | number
    customerId?: NullableIntFieldUpdateOperationsInput | number | null
    totalAmount?: NullableFloatFieldUpdateOperationsInput | number | null
    paymentDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    paymentMethod?: NullableStringFieldUpdateOperationsInput | string | null
    status?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    isPaid?: BoolFieldUpdateOperationsInput | boolean
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    orderNotes?: NullableStringFieldUpdateOperationsInput | string | null
    eventDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    eventDateHebrew?: NullableStringFieldUpdateOperationsInput | string | null
    returnDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isWeekdayEvent?: BoolFieldUpdateOperationsInput | boolean
    orderDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isAbroad?: BoolFieldUpdateOperationsInput | boolean
    fromDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    toDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type PaymentCreateInput = {
    amount: number
    paymentDate?: Date | string
    paymentMethod?: string | null
    notes?: string | null
    isDeleted?: boolean
    customer?: CustomerCreateNestedOneWithoutPaymentsInput
    order?: OrderCreateNestedOneWithoutPaymentsInput
  }

  export type PaymentUncheckedCreateInput = {
    id?: number
    customerId?: number | null
    orderId?: number | null
    amount: number
    paymentDate?: Date | string
    paymentMethod?: string | null
    notes?: string | null
    isDeleted?: boolean
  }

  export type PaymentUpdateInput = {
    amount?: FloatFieldUpdateOperationsInput | number
    paymentDate?: DateTimeFieldUpdateOperationsInput | Date | string
    paymentMethod?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    customer?: CustomerUpdateOneWithoutPaymentsNestedInput
    order?: OrderUpdateOneWithoutPaymentsNestedInput
  }

  export type PaymentUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number
    customerId?: NullableIntFieldUpdateOperationsInput | number | null
    orderId?: NullableIntFieldUpdateOperationsInput | number | null
    amount?: FloatFieldUpdateOperationsInput | number
    paymentDate?: DateTimeFieldUpdateOperationsInput | Date | string
    paymentMethod?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
  }

  export type PaymentCreateManyInput = {
    id?: number
    customerId?: number | null
    orderId?: number | null
    amount: number
    paymentDate?: Date | string
    paymentMethod?: string | null
    notes?: string | null
    isDeleted?: boolean
  }

  export type PaymentUpdateManyMutationInput = {
    amount?: FloatFieldUpdateOperationsInput | number
    paymentDate?: DateTimeFieldUpdateOperationsInput | Date | string
    paymentMethod?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
  }

  export type PaymentUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number
    customerId?: NullableIntFieldUpdateOperationsInput | number | null
    orderId?: NullableIntFieldUpdateOperationsInput | number | null
    amount?: FloatFieldUpdateOperationsInput | number
    paymentDate?: DateTimeFieldUpdateOperationsInput | Date | string
    paymentMethod?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
  }

  export type PaymentObligationCreateInput = {
    productId?: number | null
    amount: number
    quantity?: number
    description?: string | null
    createdAt?: Date | string
    isDeleted?: boolean
    isRefund?: boolean
    isManual?: boolean
    order: OrderCreateNestedOneWithoutObligationsInput
  }

  export type PaymentObligationUncheckedCreateInput = {
    id?: number
    orderId: number
    productId?: number | null
    amount: number
    quantity?: number
    description?: string | null
    createdAt?: Date | string
    isDeleted?: boolean
    isRefund?: boolean
    isManual?: boolean
  }

  export type PaymentObligationUpdateInput = {
    productId?: NullableIntFieldUpdateOperationsInput | number | null
    amount?: FloatFieldUpdateOperationsInput | number
    quantity?: IntFieldUpdateOperationsInput | number
    description?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    isRefund?: BoolFieldUpdateOperationsInput | boolean
    isManual?: BoolFieldUpdateOperationsInput | boolean
    order?: OrderUpdateOneRequiredWithoutObligationsNestedInput
  }

  export type PaymentObligationUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number
    orderId?: IntFieldUpdateOperationsInput | number
    productId?: NullableIntFieldUpdateOperationsInput | number | null
    amount?: FloatFieldUpdateOperationsInput | number
    quantity?: IntFieldUpdateOperationsInput | number
    description?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    isRefund?: BoolFieldUpdateOperationsInput | boolean
    isManual?: BoolFieldUpdateOperationsInput | boolean
  }

  export type PaymentObligationCreateManyInput = {
    id?: number
    orderId: number
    productId?: number | null
    amount: number
    quantity?: number
    description?: string | null
    createdAt?: Date | string
    isDeleted?: boolean
    isRefund?: boolean
    isManual?: boolean
  }

  export type PaymentObligationUpdateManyMutationInput = {
    productId?: NullableIntFieldUpdateOperationsInput | number | null
    amount?: FloatFieldUpdateOperationsInput | number
    quantity?: IntFieldUpdateOperationsInput | number
    description?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    isRefund?: BoolFieldUpdateOperationsInput | boolean
    isManual?: BoolFieldUpdateOperationsInput | boolean
  }

  export type PaymentObligationUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number
    orderId?: IntFieldUpdateOperationsInput | number
    productId?: NullableIntFieldUpdateOperationsInput | number | null
    amount?: FloatFieldUpdateOperationsInput | number
    quantity?: IntFieldUpdateOperationsInput | number
    description?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    isRefund?: BoolFieldUpdateOperationsInput | boolean
    isManual?: BoolFieldUpdateOperationsInput | boolean
  }

  export type OrderItemCreateInput = {
    price?: number | null
    quantity?: number | null
    description?: string | null
    sizeText?: string | null
    repairs?: string | null
    basePrice?: number | null
    finalPrice?: number | null
    barcode?: string | null
    barcodePrefix?: number | null
    size?: string | null
    isTaken?: boolean
    isReturned?: boolean
    returnedOk?: boolean
    takenDate?: Date | string | null
    returnDate?: Date | string | null
    isDeleted?: boolean
    deletedAt?: Date | string | null
    neckAlteration?: number | null
    lengthAlteration?: string | null
    sleeveAlteration?: number | null
    alterationDetails?: string | null
    alterationDone?: boolean
    order?: OrderCreateNestedOneWithoutItemsInput
    dressItem?: DressItemCreateNestedOneWithoutOrderItemsInput
  }

  export type OrderItemUncheckedCreateInput = {
    id?: number
    orderId?: number | null
    dressItemId?: number | null
    price?: number | null
    quantity?: number | null
    description?: string | null
    sizeText?: string | null
    repairs?: string | null
    basePrice?: number | null
    finalPrice?: number | null
    barcode?: string | null
    barcodePrefix?: number | null
    size?: string | null
    isTaken?: boolean
    isReturned?: boolean
    returnedOk?: boolean
    takenDate?: Date | string | null
    returnDate?: Date | string | null
    isDeleted?: boolean
    deletedAt?: Date | string | null
    neckAlteration?: number | null
    lengthAlteration?: string | null
    sleeveAlteration?: number | null
    alterationDetails?: string | null
    alterationDone?: boolean
  }

  export type OrderItemUpdateInput = {
    price?: NullableFloatFieldUpdateOperationsInput | number | null
    quantity?: NullableIntFieldUpdateOperationsInput | number | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    sizeText?: NullableStringFieldUpdateOperationsInput | string | null
    repairs?: NullableStringFieldUpdateOperationsInput | string | null
    basePrice?: NullableFloatFieldUpdateOperationsInput | number | null
    finalPrice?: NullableFloatFieldUpdateOperationsInput | number | null
    barcode?: NullableStringFieldUpdateOperationsInput | string | null
    barcodePrefix?: NullableIntFieldUpdateOperationsInput | number | null
    size?: NullableStringFieldUpdateOperationsInput | string | null
    isTaken?: BoolFieldUpdateOperationsInput | boolean
    isReturned?: BoolFieldUpdateOperationsInput | boolean
    returnedOk?: BoolFieldUpdateOperationsInput | boolean
    takenDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    returnDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    neckAlteration?: NullableIntFieldUpdateOperationsInput | number | null
    lengthAlteration?: NullableStringFieldUpdateOperationsInput | string | null
    sleeveAlteration?: NullableIntFieldUpdateOperationsInput | number | null
    alterationDetails?: NullableStringFieldUpdateOperationsInput | string | null
    alterationDone?: BoolFieldUpdateOperationsInput | boolean
    order?: OrderUpdateOneWithoutItemsNestedInput
    dressItem?: DressItemUpdateOneWithoutOrderItemsNestedInput
  }

  export type OrderItemUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number
    orderId?: NullableIntFieldUpdateOperationsInput | number | null
    dressItemId?: NullableIntFieldUpdateOperationsInput | number | null
    price?: NullableFloatFieldUpdateOperationsInput | number | null
    quantity?: NullableIntFieldUpdateOperationsInput | number | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    sizeText?: NullableStringFieldUpdateOperationsInput | string | null
    repairs?: NullableStringFieldUpdateOperationsInput | string | null
    basePrice?: NullableFloatFieldUpdateOperationsInput | number | null
    finalPrice?: NullableFloatFieldUpdateOperationsInput | number | null
    barcode?: NullableStringFieldUpdateOperationsInput | string | null
    barcodePrefix?: NullableIntFieldUpdateOperationsInput | number | null
    size?: NullableStringFieldUpdateOperationsInput | string | null
    isTaken?: BoolFieldUpdateOperationsInput | boolean
    isReturned?: BoolFieldUpdateOperationsInput | boolean
    returnedOk?: BoolFieldUpdateOperationsInput | boolean
    takenDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    returnDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    neckAlteration?: NullableIntFieldUpdateOperationsInput | number | null
    lengthAlteration?: NullableStringFieldUpdateOperationsInput | string | null
    sleeveAlteration?: NullableIntFieldUpdateOperationsInput | number | null
    alterationDetails?: NullableStringFieldUpdateOperationsInput | string | null
    alterationDone?: BoolFieldUpdateOperationsInput | boolean
  }

  export type OrderItemCreateManyInput = {
    id?: number
    orderId?: number | null
    dressItemId?: number | null
    price?: number | null
    quantity?: number | null
    description?: string | null
    sizeText?: string | null
    repairs?: string | null
    basePrice?: number | null
    finalPrice?: number | null
    barcode?: string | null
    barcodePrefix?: number | null
    size?: string | null
    isTaken?: boolean
    isReturned?: boolean
    returnedOk?: boolean
    takenDate?: Date | string | null
    returnDate?: Date | string | null
    isDeleted?: boolean
    deletedAt?: Date | string | null
    neckAlteration?: number | null
    lengthAlteration?: string | null
    sleeveAlteration?: number | null
    alterationDetails?: string | null
    alterationDone?: boolean
  }

  export type OrderItemUpdateManyMutationInput = {
    price?: NullableFloatFieldUpdateOperationsInput | number | null
    quantity?: NullableIntFieldUpdateOperationsInput | number | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    sizeText?: NullableStringFieldUpdateOperationsInput | string | null
    repairs?: NullableStringFieldUpdateOperationsInput | string | null
    basePrice?: NullableFloatFieldUpdateOperationsInput | number | null
    finalPrice?: NullableFloatFieldUpdateOperationsInput | number | null
    barcode?: NullableStringFieldUpdateOperationsInput | string | null
    barcodePrefix?: NullableIntFieldUpdateOperationsInput | number | null
    size?: NullableStringFieldUpdateOperationsInput | string | null
    isTaken?: BoolFieldUpdateOperationsInput | boolean
    isReturned?: BoolFieldUpdateOperationsInput | boolean
    returnedOk?: BoolFieldUpdateOperationsInput | boolean
    takenDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    returnDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    neckAlteration?: NullableIntFieldUpdateOperationsInput | number | null
    lengthAlteration?: NullableStringFieldUpdateOperationsInput | string | null
    sleeveAlteration?: NullableIntFieldUpdateOperationsInput | number | null
    alterationDetails?: NullableStringFieldUpdateOperationsInput | string | null
    alterationDone?: BoolFieldUpdateOperationsInput | boolean
  }

  export type OrderItemUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number
    orderId?: NullableIntFieldUpdateOperationsInput | number | null
    dressItemId?: NullableIntFieldUpdateOperationsInput | number | null
    price?: NullableFloatFieldUpdateOperationsInput | number | null
    quantity?: NullableIntFieldUpdateOperationsInput | number | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    sizeText?: NullableStringFieldUpdateOperationsInput | string | null
    repairs?: NullableStringFieldUpdateOperationsInput | string | null
    basePrice?: NullableFloatFieldUpdateOperationsInput | number | null
    finalPrice?: NullableFloatFieldUpdateOperationsInput | number | null
    barcode?: NullableStringFieldUpdateOperationsInput | string | null
    barcodePrefix?: NullableIntFieldUpdateOperationsInput | number | null
    size?: NullableStringFieldUpdateOperationsInput | string | null
    isTaken?: BoolFieldUpdateOperationsInput | boolean
    isReturned?: BoolFieldUpdateOperationsInput | boolean
    returnedOk?: BoolFieldUpdateOperationsInput | boolean
    takenDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    returnDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    neckAlteration?: NullableIntFieldUpdateOperationsInput | number | null
    lengthAlteration?: NullableStringFieldUpdateOperationsInput | string | null
    sleeveAlteration?: NullableIntFieldUpdateOperationsInput | number | null
    alterationDetails?: NullableStringFieldUpdateOperationsInput | string | null
    alterationDone?: BoolFieldUpdateOperationsInput | boolean
  }

  export type PriceListCreateInput = {
    description?: string | null
    fromSize?: number | null
    toSize?: number | null
    price?: number | null
    startDate?: Date | string | null
    endDate?: Date | string | null
    category?: string | null
    deposit?: number | null
  }

  export type PriceListUncheckedCreateInput = {
    id?: number
    description?: string | null
    fromSize?: number | null
    toSize?: number | null
    price?: number | null
    startDate?: Date | string | null
    endDate?: Date | string | null
    category?: string | null
    deposit?: number | null
  }

  export type PriceListUpdateInput = {
    description?: NullableStringFieldUpdateOperationsInput | string | null
    fromSize?: NullableIntFieldUpdateOperationsInput | number | null
    toSize?: NullableIntFieldUpdateOperationsInput | number | null
    price?: NullableFloatFieldUpdateOperationsInput | number | null
    startDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    endDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    category?: NullableStringFieldUpdateOperationsInput | string | null
    deposit?: NullableFloatFieldUpdateOperationsInput | number | null
  }

  export type PriceListUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number
    description?: NullableStringFieldUpdateOperationsInput | string | null
    fromSize?: NullableIntFieldUpdateOperationsInput | number | null
    toSize?: NullableIntFieldUpdateOperationsInput | number | null
    price?: NullableFloatFieldUpdateOperationsInput | number | null
    startDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    endDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    category?: NullableStringFieldUpdateOperationsInput | string | null
    deposit?: NullableFloatFieldUpdateOperationsInput | number | null
  }

  export type PriceListCreateManyInput = {
    id?: number
    description?: string | null
    fromSize?: number | null
    toSize?: number | null
    price?: number | null
    startDate?: Date | string | null
    endDate?: Date | string | null
    category?: string | null
    deposit?: number | null
  }

  export type PriceListUpdateManyMutationInput = {
    description?: NullableStringFieldUpdateOperationsInput | string | null
    fromSize?: NullableIntFieldUpdateOperationsInput | number | null
    toSize?: NullableIntFieldUpdateOperationsInput | number | null
    price?: NullableFloatFieldUpdateOperationsInput | number | null
    startDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    endDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    category?: NullableStringFieldUpdateOperationsInput | string | null
    deposit?: NullableFloatFieldUpdateOperationsInput | number | null
  }

  export type PriceListUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number
    description?: NullableStringFieldUpdateOperationsInput | string | null
    fromSize?: NullableIntFieldUpdateOperationsInput | number | null
    toSize?: NullableIntFieldUpdateOperationsInput | number | null
    price?: NullableFloatFieldUpdateOperationsInput | number | null
    startDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    endDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    category?: NullableStringFieldUpdateOperationsInput | string | null
    deposit?: NullableFloatFieldUpdateOperationsInput | number | null
  }

  export type SystemSettingCreateInput = {
    key: string
    value?: string | null
    name?: string | null
    category?: string | null
    notes?: string | null
    type?: string
  }

  export type SystemSettingUncheckedCreateInput = {
    id?: number
    key: string
    value?: string | null
    name?: string | null
    category?: string | null
    notes?: string | null
    type?: string
  }

  export type SystemSettingUpdateInput = {
    key?: StringFieldUpdateOperationsInput | string
    value?: NullableStringFieldUpdateOperationsInput | string | null
    name?: NullableStringFieldUpdateOperationsInput | string | null
    category?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    type?: StringFieldUpdateOperationsInput | string
  }

  export type SystemSettingUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number
    key?: StringFieldUpdateOperationsInput | string
    value?: NullableStringFieldUpdateOperationsInput | string | null
    name?: NullableStringFieldUpdateOperationsInput | string | null
    category?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    type?: StringFieldUpdateOperationsInput | string
  }

  export type SystemSettingCreateManyInput = {
    id?: number
    key: string
    value?: string | null
    name?: string | null
    category?: string | null
    notes?: string | null
    type?: string
  }

  export type SystemSettingUpdateManyMutationInput = {
    key?: StringFieldUpdateOperationsInput | string
    value?: NullableStringFieldUpdateOperationsInput | string | null
    name?: NullableStringFieldUpdateOperationsInput | string | null
    category?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    type?: StringFieldUpdateOperationsInput | string
  }

  export type SystemSettingUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number
    key?: StringFieldUpdateOperationsInput | string
    value?: NullableStringFieldUpdateOperationsInput | string | null
    name?: NullableStringFieldUpdateOperationsInput | string | null
    category?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    type?: StringFieldUpdateOperationsInput | string
  }

  export type PriceRuleCreateInput = {
    description?: string | null
    minSize?: number | null
    maxSize?: number | null
    price?: number | null
    startDate?: Date | string | null
    endDate?: Date | string | null
    category?: string | null
    refund?: number | null
  }

  export type PriceRuleUncheckedCreateInput = {
    id?: number
    description?: string | null
    minSize?: number | null
    maxSize?: number | null
    price?: number | null
    startDate?: Date | string | null
    endDate?: Date | string | null
    category?: string | null
    refund?: number | null
  }

  export type PriceRuleUpdateInput = {
    description?: NullableStringFieldUpdateOperationsInput | string | null
    minSize?: NullableIntFieldUpdateOperationsInput | number | null
    maxSize?: NullableIntFieldUpdateOperationsInput | number | null
    price?: NullableFloatFieldUpdateOperationsInput | number | null
    startDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    endDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    category?: NullableStringFieldUpdateOperationsInput | string | null
    refund?: NullableFloatFieldUpdateOperationsInput | number | null
  }

  export type PriceRuleUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number
    description?: NullableStringFieldUpdateOperationsInput | string | null
    minSize?: NullableIntFieldUpdateOperationsInput | number | null
    maxSize?: NullableIntFieldUpdateOperationsInput | number | null
    price?: NullableFloatFieldUpdateOperationsInput | number | null
    startDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    endDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    category?: NullableStringFieldUpdateOperationsInput | string | null
    refund?: NullableFloatFieldUpdateOperationsInput | number | null
  }

  export type PriceRuleCreateManyInput = {
    id?: number
    description?: string | null
    minSize?: number | null
    maxSize?: number | null
    price?: number | null
    startDate?: Date | string | null
    endDate?: Date | string | null
    category?: string | null
    refund?: number | null
  }

  export type PriceRuleUpdateManyMutationInput = {
    description?: NullableStringFieldUpdateOperationsInput | string | null
    minSize?: NullableIntFieldUpdateOperationsInput | number | null
    maxSize?: NullableIntFieldUpdateOperationsInput | number | null
    price?: NullableFloatFieldUpdateOperationsInput | number | null
    startDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    endDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    category?: NullableStringFieldUpdateOperationsInput | string | null
    refund?: NullableFloatFieldUpdateOperationsInput | number | null
  }

  export type PriceRuleUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number
    description?: NullableStringFieldUpdateOperationsInput | string | null
    minSize?: NullableIntFieldUpdateOperationsInput | number | null
    maxSize?: NullableIntFieldUpdateOperationsInput | number | null
    price?: NullableFloatFieldUpdateOperationsInput | number | null
    startDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    endDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    category?: NullableStringFieldUpdateOperationsInput | string | null
    refund?: NullableFloatFieldUpdateOperationsInput | number | null
  }

  export type PageVisitLogCreateInput = {
    pageUrl: string
    employeeName?: string | null
    timestamp?: Date | string
    loadingError?: string | null
    isGuest?: boolean
    employee?: EmployeeCreateNestedOneWithoutPageVisitsInput
  }

  export type PageVisitLogUncheckedCreateInput = {
    id?: number
    pageUrl: string
    employeeId?: number | null
    employeeName?: string | null
    timestamp?: Date | string
    loadingError?: string | null
    isGuest?: boolean
  }

  export type PageVisitLogUpdateInput = {
    pageUrl?: StringFieldUpdateOperationsInput | string
    employeeName?: NullableStringFieldUpdateOperationsInput | string | null
    timestamp?: DateTimeFieldUpdateOperationsInput | Date | string
    loadingError?: NullableStringFieldUpdateOperationsInput | string | null
    isGuest?: BoolFieldUpdateOperationsInput | boolean
    employee?: EmployeeUpdateOneWithoutPageVisitsNestedInput
  }

  export type PageVisitLogUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number
    pageUrl?: StringFieldUpdateOperationsInput | string
    employeeId?: NullableIntFieldUpdateOperationsInput | number | null
    employeeName?: NullableStringFieldUpdateOperationsInput | string | null
    timestamp?: DateTimeFieldUpdateOperationsInput | Date | string
    loadingError?: NullableStringFieldUpdateOperationsInput | string | null
    isGuest?: BoolFieldUpdateOperationsInput | boolean
  }

  export type PageVisitLogCreateManyInput = {
    id?: number
    pageUrl: string
    employeeId?: number | null
    employeeName?: string | null
    timestamp?: Date | string
    loadingError?: string | null
    isGuest?: boolean
  }

  export type PageVisitLogUpdateManyMutationInput = {
    pageUrl?: StringFieldUpdateOperationsInput | string
    employeeName?: NullableStringFieldUpdateOperationsInput | string | null
    timestamp?: DateTimeFieldUpdateOperationsInput | Date | string
    loadingError?: NullableStringFieldUpdateOperationsInput | string | null
    isGuest?: BoolFieldUpdateOperationsInput | boolean
  }

  export type PageVisitLogUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number
    pageUrl?: StringFieldUpdateOperationsInput | string
    employeeId?: NullableIntFieldUpdateOperationsInput | number | null
    employeeName?: NullableStringFieldUpdateOperationsInput | string | null
    timestamp?: DateTimeFieldUpdateOperationsInput | Date | string
    loadingError?: NullableStringFieldUpdateOperationsInput | string | null
    isGuest?: BoolFieldUpdateOperationsInput | boolean
  }

  export type EmailLogCreateInput = {
    to: string
    cc?: string | null
    subject?: string | null
    body?: string | null
    fileName?: string | null
    status: string
    errorMessage?: string | null
    customerId?: number | null
    employeeId?: number | null
    sentAt?: Date | string
  }

  export type EmailLogUncheckedCreateInput = {
    id?: number
    to: string
    cc?: string | null
    subject?: string | null
    body?: string | null
    fileName?: string | null
    status: string
    errorMessage?: string | null
    customerId?: number | null
    employeeId?: number | null
    sentAt?: Date | string
  }

  export type EmailLogUpdateInput = {
    to?: StringFieldUpdateOperationsInput | string
    cc?: NullableStringFieldUpdateOperationsInput | string | null
    subject?: NullableStringFieldUpdateOperationsInput | string | null
    body?: NullableStringFieldUpdateOperationsInput | string | null
    fileName?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    errorMessage?: NullableStringFieldUpdateOperationsInput | string | null
    customerId?: NullableIntFieldUpdateOperationsInput | number | null
    employeeId?: NullableIntFieldUpdateOperationsInput | number | null
    sentAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type EmailLogUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number
    to?: StringFieldUpdateOperationsInput | string
    cc?: NullableStringFieldUpdateOperationsInput | string | null
    subject?: NullableStringFieldUpdateOperationsInput | string | null
    body?: NullableStringFieldUpdateOperationsInput | string | null
    fileName?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    errorMessage?: NullableStringFieldUpdateOperationsInput | string | null
    customerId?: NullableIntFieldUpdateOperationsInput | number | null
    employeeId?: NullableIntFieldUpdateOperationsInput | number | null
    sentAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type EmailLogCreateManyInput = {
    id?: number
    to: string
    cc?: string | null
    subject?: string | null
    body?: string | null
    fileName?: string | null
    status: string
    errorMessage?: string | null
    customerId?: number | null
    employeeId?: number | null
    sentAt?: Date | string
  }

  export type EmailLogUpdateManyMutationInput = {
    to?: StringFieldUpdateOperationsInput | string
    cc?: NullableStringFieldUpdateOperationsInput | string | null
    subject?: NullableStringFieldUpdateOperationsInput | string | null
    body?: NullableStringFieldUpdateOperationsInput | string | null
    fileName?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    errorMessage?: NullableStringFieldUpdateOperationsInput | string | null
    customerId?: NullableIntFieldUpdateOperationsInput | number | null
    employeeId?: NullableIntFieldUpdateOperationsInput | number | null
    sentAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type EmailLogUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number
    to?: StringFieldUpdateOperationsInput | string
    cc?: NullableStringFieldUpdateOperationsInput | string | null
    subject?: NullableStringFieldUpdateOperationsInput | string | null
    body?: NullableStringFieldUpdateOperationsInput | string | null
    fileName?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    errorMessage?: NullableStringFieldUpdateOperationsInput | string | null
    customerId?: NullableIntFieldUpdateOperationsInput | number | null
    employeeId?: NullableIntFieldUpdateOperationsInput | number | null
    sentAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type IntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[]
    notIn?: number[]
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type StringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | null
    notIn?: string[] | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type IntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | null
    notIn?: number[] | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type BoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type OrderListRelationFilter = {
    every?: OrderWhereInput
    some?: OrderWhereInput
    none?: OrderWhereInput
  }

  export type PaymentListRelationFilter = {
    every?: PaymentWhereInput
    some?: PaymentWhereInput
    none?: PaymentWhereInput
  }

  export type SortOrderInput = {
    sort: SortOrder
    nulls?: NullsOrder
  }

  export type OrderOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type PaymentOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type CustomerCountOrderByAggregateInput = {
    id?: SortOrder
    firstName?: SortOrder
    lastName?: SortOrder
    phone1?: SortOrder
    phone2?: SortOrder
    city?: SortOrder
    street?: SortOrder
    houseNum?: SortOrder
    email?: SortOrder
    emailSuffix?: SortOrder
    notes?: SortOrder
    registrationDate?: SortOrder
    officeNotes?: SortOrder
    isDeleted?: SortOrder
  }

  export type CustomerAvgOrderByAggregateInput = {
    id?: SortOrder
    houseNum?: SortOrder
  }

  export type CustomerMaxOrderByAggregateInput = {
    id?: SortOrder
    firstName?: SortOrder
    lastName?: SortOrder
    phone1?: SortOrder
    phone2?: SortOrder
    city?: SortOrder
    street?: SortOrder
    houseNum?: SortOrder
    email?: SortOrder
    emailSuffix?: SortOrder
    notes?: SortOrder
    registrationDate?: SortOrder
    officeNotes?: SortOrder
    isDeleted?: SortOrder
  }

  export type CustomerMinOrderByAggregateInput = {
    id?: SortOrder
    firstName?: SortOrder
    lastName?: SortOrder
    phone1?: SortOrder
    phone2?: SortOrder
    city?: SortOrder
    street?: SortOrder
    houseNum?: SortOrder
    email?: SortOrder
    emailSuffix?: SortOrder
    notes?: SortOrder
    registrationDate?: SortOrder
    officeNotes?: SortOrder
    isDeleted?: SortOrder
  }

  export type CustomerSumOrderByAggregateInput = {
    id?: SortOrder
    houseNum?: SortOrder
  }

  export type IntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[]
    notIn?: number[]
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type StringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | null
    notIn?: string[] | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type IntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | null
    notIn?: number[] | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedIntNullableFilter<$PrismaModel>
    _max?: NestedIntNullableFilter<$PrismaModel>
  }

  export type BoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type StringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[]
    notIn?: string[]
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type DateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[]
    notIn?: Date[] | string[]
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type AuditLogCountOrderByAggregateInput = {
    id?: SortOrder
    entityType?: SortOrder
    entityId?: SortOrder
    action?: SortOrder
    changesJson?: SortOrder
    createdAt?: SortOrder
    employeeId?: SortOrder
  }

  export type AuditLogAvgOrderByAggregateInput = {
    id?: SortOrder
    entityId?: SortOrder
    employeeId?: SortOrder
  }

  export type AuditLogMaxOrderByAggregateInput = {
    id?: SortOrder
    entityType?: SortOrder
    entityId?: SortOrder
    action?: SortOrder
    changesJson?: SortOrder
    createdAt?: SortOrder
    employeeId?: SortOrder
  }

  export type AuditLogMinOrderByAggregateInput = {
    id?: SortOrder
    entityType?: SortOrder
    entityId?: SortOrder
    action?: SortOrder
    changesJson?: SortOrder
    createdAt?: SortOrder
    employeeId?: SortOrder
  }

  export type AuditLogSumOrderByAggregateInput = {
    id?: SortOrder
    entityId?: SortOrder
    employeeId?: SortOrder
  }

  export type StringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[]
    notIn?: string[]
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type DateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[]
    notIn?: Date[] | string[]
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type DateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | null
    notIn?: Date[] | string[] | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type FloatNullableFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | null
    notIn?: number[] | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableFilter<$PrismaModel> | number | null
  }

  export type BoolNullableFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel> | null
    not?: NestedBoolNullableFilter<$PrismaModel> | boolean | null
  }

  export type PageVisitLogListRelationFilter = {
    every?: PageVisitLogWhereInput
    some?: PageVisitLogWhereInput
    none?: PageVisitLogWhereInput
  }

  export type ShiftListRelationFilter = {
    every?: ShiftWhereInput
    some?: ShiftWhereInput
    none?: ShiftWhereInput
  }

  export type PageVisitLogOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type ShiftOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type EmployeeCountOrderByAggregateInput = {
    id?: SortOrder
    firstName?: SortOrder
    lastName?: SortOrder
    phone1?: SortOrder
    phone2?: SortOrder
    city?: SortOrder
    street?: SortOrder
    houseNum?: SortOrder
    email?: SortOrder
    joinDate?: SortOrder
    fullName?: SortOrder
    notes?: SortOrder
    emailSuffix?: SortOrder
    roleId?: SortOrder
    password?: SortOrder
    isActive?: SortOrder
    hourlyWage?: SortOrder
    paymentMethod?: SortOrder
    travelExpenses?: SortOrder
  }

  export type EmployeeAvgOrderByAggregateInput = {
    id?: SortOrder
    roleId?: SortOrder
    hourlyWage?: SortOrder
  }

  export type EmployeeMaxOrderByAggregateInput = {
    id?: SortOrder
    firstName?: SortOrder
    lastName?: SortOrder
    phone1?: SortOrder
    phone2?: SortOrder
    city?: SortOrder
    street?: SortOrder
    houseNum?: SortOrder
    email?: SortOrder
    joinDate?: SortOrder
    fullName?: SortOrder
    notes?: SortOrder
    emailSuffix?: SortOrder
    roleId?: SortOrder
    password?: SortOrder
    isActive?: SortOrder
    hourlyWage?: SortOrder
    paymentMethod?: SortOrder
    travelExpenses?: SortOrder
  }

  export type EmployeeMinOrderByAggregateInput = {
    id?: SortOrder
    firstName?: SortOrder
    lastName?: SortOrder
    phone1?: SortOrder
    phone2?: SortOrder
    city?: SortOrder
    street?: SortOrder
    houseNum?: SortOrder
    email?: SortOrder
    joinDate?: SortOrder
    fullName?: SortOrder
    notes?: SortOrder
    emailSuffix?: SortOrder
    roleId?: SortOrder
    password?: SortOrder
    isActive?: SortOrder
    hourlyWage?: SortOrder
    paymentMethod?: SortOrder
    travelExpenses?: SortOrder
  }

  export type EmployeeSumOrderByAggregateInput = {
    id?: SortOrder
    roleId?: SortOrder
    hourlyWage?: SortOrder
  }

  export type DateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | null
    notIn?: Date[] | string[] | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type FloatNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | null
    notIn?: number[] | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedFloatNullableFilter<$PrismaModel>
    _min?: NestedFloatNullableFilter<$PrismaModel>
    _max?: NestedFloatNullableFilter<$PrismaModel>
  }

  export type BoolNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel> | null
    not?: NestedBoolNullableWithAggregatesFilter<$PrismaModel> | boolean | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedBoolNullableFilter<$PrismaModel>
    _max?: NestedBoolNullableFilter<$PrismaModel>
  }

  export type EmployeeRelationFilter = {
    is?: EmployeeWhereInput
    isNot?: EmployeeWhereInput
  }

  export type ShiftCountOrderByAggregateInput = {
    id?: SortOrder
    employeeId?: SortOrder
    entryTime?: SortOrder
    exitTime?: SortOrder
    hebrewDate?: SortOrder
    date?: SortOrder
    totalMinutes?: SortOrder
    hourlyWageSnapshot?: SortOrder
    travelExpensesSnapshot?: SortOrder
    totalCalculated?: SortOrder
    paymentMethod?: SortOrder
    notes?: SortOrder
    isDeleted?: SortOrder
  }

  export type ShiftAvgOrderByAggregateInput = {
    id?: SortOrder
    employeeId?: SortOrder
    totalMinutes?: SortOrder
    hourlyWageSnapshot?: SortOrder
    travelExpensesSnapshot?: SortOrder
    totalCalculated?: SortOrder
  }

  export type ShiftMaxOrderByAggregateInput = {
    id?: SortOrder
    employeeId?: SortOrder
    entryTime?: SortOrder
    exitTime?: SortOrder
    hebrewDate?: SortOrder
    date?: SortOrder
    totalMinutes?: SortOrder
    hourlyWageSnapshot?: SortOrder
    travelExpensesSnapshot?: SortOrder
    totalCalculated?: SortOrder
    paymentMethod?: SortOrder
    notes?: SortOrder
    isDeleted?: SortOrder
  }

  export type ShiftMinOrderByAggregateInput = {
    id?: SortOrder
    employeeId?: SortOrder
    entryTime?: SortOrder
    exitTime?: SortOrder
    hebrewDate?: SortOrder
    date?: SortOrder
    totalMinutes?: SortOrder
    hourlyWageSnapshot?: SortOrder
    travelExpensesSnapshot?: SortOrder
    totalCalculated?: SortOrder
    paymentMethod?: SortOrder
    notes?: SortOrder
    isDeleted?: SortOrder
  }

  export type ShiftSumOrderByAggregateInput = {
    id?: SortOrder
    employeeId?: SortOrder
    totalMinutes?: SortOrder
    hourlyWageSnapshot?: SortOrder
    travelExpensesSnapshot?: SortOrder
    totalCalculated?: SortOrder
  }

  export type DressItemListRelationFilter = {
    every?: DressItemWhereInput
    some?: DressItemWhereInput
    none?: DressItemWhereInput
  }

  export type DressItemOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type DressModelCountOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    barcodePrefix?: SortOrder
    priceCategory?: SortOrder
    notes?: SortOrder
    inInspection?: SortOrder
    imageUrl?: SortOrder
    entryDateToRepo?: SortOrder
    exitDateFromRepo?: SortOrder
    isDeleted?: SortOrder
    deletedAt?: SortOrder
  }

  export type DressModelAvgOrderByAggregateInput = {
    id?: SortOrder
    barcodePrefix?: SortOrder
  }

  export type DressModelMaxOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    barcodePrefix?: SortOrder
    priceCategory?: SortOrder
    notes?: SortOrder
    inInspection?: SortOrder
    imageUrl?: SortOrder
    entryDateToRepo?: SortOrder
    exitDateFromRepo?: SortOrder
    isDeleted?: SortOrder
    deletedAt?: SortOrder
  }

  export type DressModelMinOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    barcodePrefix?: SortOrder
    priceCategory?: SortOrder
    notes?: SortOrder
    inInspection?: SortOrder
    imageUrl?: SortOrder
    entryDateToRepo?: SortOrder
    exitDateFromRepo?: SortOrder
    isDeleted?: SortOrder
    deletedAt?: SortOrder
  }

  export type DressModelSumOrderByAggregateInput = {
    id?: SortOrder
    barcodePrefix?: SortOrder
  }

  export type DressModelNullableRelationFilter = {
    is?: DressModelWhereInput | null
    isNot?: DressModelWhereInput | null
  }

  export type OrderItemListRelationFilter = {
    every?: OrderItemWhereInput
    some?: OrderItemWhereInput
    none?: OrderItemWhereInput
  }

  export type OrderItemOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type DressItemCountOrderByAggregateInput = {
    id?: SortOrder
    barcodePrefix?: SortOrder
    dressModelId?: SortOrder
    dressName?: SortOrder
    sizeText?: SortOrder
    serialNumber?: SortOrder
    dressBarcode?: SortOrder
    location?: SortOrder
    locationNum?: SortOrder
    quantity?: SortOrder
    inRepair?: SortOrder
    notInUse?: SortOrder
    notInUseSince?: SortOrder
    entryDateToRepo?: SortOrder
    isDeleted?: SortOrder
    deletedAt?: SortOrder
  }

  export type DressItemAvgOrderByAggregateInput = {
    id?: SortOrder
    barcodePrefix?: SortOrder
    dressModelId?: SortOrder
    serialNumber?: SortOrder
    locationNum?: SortOrder
    quantity?: SortOrder
  }

  export type DressItemMaxOrderByAggregateInput = {
    id?: SortOrder
    barcodePrefix?: SortOrder
    dressModelId?: SortOrder
    dressName?: SortOrder
    sizeText?: SortOrder
    serialNumber?: SortOrder
    dressBarcode?: SortOrder
    location?: SortOrder
    locationNum?: SortOrder
    quantity?: SortOrder
    inRepair?: SortOrder
    notInUse?: SortOrder
    notInUseSince?: SortOrder
    entryDateToRepo?: SortOrder
    isDeleted?: SortOrder
    deletedAt?: SortOrder
  }

  export type DressItemMinOrderByAggregateInput = {
    id?: SortOrder
    barcodePrefix?: SortOrder
    dressModelId?: SortOrder
    dressName?: SortOrder
    sizeText?: SortOrder
    serialNumber?: SortOrder
    dressBarcode?: SortOrder
    location?: SortOrder
    locationNum?: SortOrder
    quantity?: SortOrder
    inRepair?: SortOrder
    notInUse?: SortOrder
    notInUseSince?: SortOrder
    entryDateToRepo?: SortOrder
    isDeleted?: SortOrder
    deletedAt?: SortOrder
  }

  export type DressItemSumOrderByAggregateInput = {
    id?: SortOrder
    barcodePrefix?: SortOrder
    dressModelId?: SortOrder
    serialNumber?: SortOrder
    locationNum?: SortOrder
    quantity?: SortOrder
  }

  export type CustomerNullableRelationFilter = {
    is?: CustomerWhereInput | null
    isNot?: CustomerWhereInput | null
  }

  export type PaymentObligationListRelationFilter = {
    every?: PaymentObligationWhereInput
    some?: PaymentObligationWhereInput
    none?: PaymentObligationWhereInput
  }

  export type PaymentObligationOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type OrderCountOrderByAggregateInput = {
    id?: SortOrder
    orderId?: SortOrder
    customerId?: SortOrder
    totalAmount?: SortOrder
    paymentDate?: SortOrder
    paymentMethod?: SortOrder
    status?: SortOrder
    notes?: SortOrder
    isPaid?: SortOrder
    isDeleted?: SortOrder
    orderNotes?: SortOrder
    eventDate?: SortOrder
    eventDateHebrew?: SortOrder
    returnDate?: SortOrder
    isWeekdayEvent?: SortOrder
    orderDate?: SortOrder
    isAbroad?: SortOrder
    fromDate?: SortOrder
    toDate?: SortOrder
  }

  export type OrderAvgOrderByAggregateInput = {
    id?: SortOrder
    orderId?: SortOrder
    customerId?: SortOrder
    totalAmount?: SortOrder
  }

  export type OrderMaxOrderByAggregateInput = {
    id?: SortOrder
    orderId?: SortOrder
    customerId?: SortOrder
    totalAmount?: SortOrder
    paymentDate?: SortOrder
    paymentMethod?: SortOrder
    status?: SortOrder
    notes?: SortOrder
    isPaid?: SortOrder
    isDeleted?: SortOrder
    orderNotes?: SortOrder
    eventDate?: SortOrder
    eventDateHebrew?: SortOrder
    returnDate?: SortOrder
    isWeekdayEvent?: SortOrder
    orderDate?: SortOrder
    isAbroad?: SortOrder
    fromDate?: SortOrder
    toDate?: SortOrder
  }

  export type OrderMinOrderByAggregateInput = {
    id?: SortOrder
    orderId?: SortOrder
    customerId?: SortOrder
    totalAmount?: SortOrder
    paymentDate?: SortOrder
    paymentMethod?: SortOrder
    status?: SortOrder
    notes?: SortOrder
    isPaid?: SortOrder
    isDeleted?: SortOrder
    orderNotes?: SortOrder
    eventDate?: SortOrder
    eventDateHebrew?: SortOrder
    returnDate?: SortOrder
    isWeekdayEvent?: SortOrder
    orderDate?: SortOrder
    isAbroad?: SortOrder
    fromDate?: SortOrder
    toDate?: SortOrder
  }

  export type OrderSumOrderByAggregateInput = {
    id?: SortOrder
    orderId?: SortOrder
    customerId?: SortOrder
    totalAmount?: SortOrder
  }

  export type FloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[]
    notIn?: number[]
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }

  export type OrderNullableRelationFilter = {
    is?: OrderWhereInput | null
    isNot?: OrderWhereInput | null
  }

  export type PaymentCountOrderByAggregateInput = {
    id?: SortOrder
    customerId?: SortOrder
    orderId?: SortOrder
    amount?: SortOrder
    paymentDate?: SortOrder
    paymentMethod?: SortOrder
    notes?: SortOrder
    isDeleted?: SortOrder
  }

  export type PaymentAvgOrderByAggregateInput = {
    id?: SortOrder
    customerId?: SortOrder
    orderId?: SortOrder
    amount?: SortOrder
  }

  export type PaymentMaxOrderByAggregateInput = {
    id?: SortOrder
    customerId?: SortOrder
    orderId?: SortOrder
    amount?: SortOrder
    paymentDate?: SortOrder
    paymentMethod?: SortOrder
    notes?: SortOrder
    isDeleted?: SortOrder
  }

  export type PaymentMinOrderByAggregateInput = {
    id?: SortOrder
    customerId?: SortOrder
    orderId?: SortOrder
    amount?: SortOrder
    paymentDate?: SortOrder
    paymentMethod?: SortOrder
    notes?: SortOrder
    isDeleted?: SortOrder
  }

  export type PaymentSumOrderByAggregateInput = {
    id?: SortOrder
    customerId?: SortOrder
    orderId?: SortOrder
    amount?: SortOrder
  }

  export type FloatWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[]
    notIn?: number[]
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedFloatFilter<$PrismaModel>
    _min?: NestedFloatFilter<$PrismaModel>
    _max?: NestedFloatFilter<$PrismaModel>
  }

  export type OrderRelationFilter = {
    is?: OrderWhereInput
    isNot?: OrderWhereInput
  }

  export type PaymentObligationCountOrderByAggregateInput = {
    id?: SortOrder
    orderId?: SortOrder
    productId?: SortOrder
    amount?: SortOrder
    quantity?: SortOrder
    description?: SortOrder
    createdAt?: SortOrder
    isDeleted?: SortOrder
    isRefund?: SortOrder
    isManual?: SortOrder
  }

  export type PaymentObligationAvgOrderByAggregateInput = {
    id?: SortOrder
    orderId?: SortOrder
    productId?: SortOrder
    amount?: SortOrder
    quantity?: SortOrder
  }

  export type PaymentObligationMaxOrderByAggregateInput = {
    id?: SortOrder
    orderId?: SortOrder
    productId?: SortOrder
    amount?: SortOrder
    quantity?: SortOrder
    description?: SortOrder
    createdAt?: SortOrder
    isDeleted?: SortOrder
    isRefund?: SortOrder
    isManual?: SortOrder
  }

  export type PaymentObligationMinOrderByAggregateInput = {
    id?: SortOrder
    orderId?: SortOrder
    productId?: SortOrder
    amount?: SortOrder
    quantity?: SortOrder
    description?: SortOrder
    createdAt?: SortOrder
    isDeleted?: SortOrder
    isRefund?: SortOrder
    isManual?: SortOrder
  }

  export type PaymentObligationSumOrderByAggregateInput = {
    id?: SortOrder
    orderId?: SortOrder
    productId?: SortOrder
    amount?: SortOrder
    quantity?: SortOrder
  }

  export type DressItemNullableRelationFilter = {
    is?: DressItemWhereInput | null
    isNot?: DressItemWhereInput | null
  }

  export type OrderItemCountOrderByAggregateInput = {
    id?: SortOrder
    orderId?: SortOrder
    dressItemId?: SortOrder
    price?: SortOrder
    quantity?: SortOrder
    description?: SortOrder
    sizeText?: SortOrder
    repairs?: SortOrder
    basePrice?: SortOrder
    finalPrice?: SortOrder
    barcode?: SortOrder
    barcodePrefix?: SortOrder
    size?: SortOrder
    isTaken?: SortOrder
    isReturned?: SortOrder
    returnedOk?: SortOrder
    takenDate?: SortOrder
    returnDate?: SortOrder
    isDeleted?: SortOrder
    deletedAt?: SortOrder
    neckAlteration?: SortOrder
    lengthAlteration?: SortOrder
    sleeveAlteration?: SortOrder
    alterationDetails?: SortOrder
    alterationDone?: SortOrder
  }

  export type OrderItemAvgOrderByAggregateInput = {
    id?: SortOrder
    orderId?: SortOrder
    dressItemId?: SortOrder
    price?: SortOrder
    quantity?: SortOrder
    basePrice?: SortOrder
    finalPrice?: SortOrder
    barcodePrefix?: SortOrder
    neckAlteration?: SortOrder
    sleeveAlteration?: SortOrder
  }

  export type OrderItemMaxOrderByAggregateInput = {
    id?: SortOrder
    orderId?: SortOrder
    dressItemId?: SortOrder
    price?: SortOrder
    quantity?: SortOrder
    description?: SortOrder
    sizeText?: SortOrder
    repairs?: SortOrder
    basePrice?: SortOrder
    finalPrice?: SortOrder
    barcode?: SortOrder
    barcodePrefix?: SortOrder
    size?: SortOrder
    isTaken?: SortOrder
    isReturned?: SortOrder
    returnedOk?: SortOrder
    takenDate?: SortOrder
    returnDate?: SortOrder
    isDeleted?: SortOrder
    deletedAt?: SortOrder
    neckAlteration?: SortOrder
    lengthAlteration?: SortOrder
    sleeveAlteration?: SortOrder
    alterationDetails?: SortOrder
    alterationDone?: SortOrder
  }

  export type OrderItemMinOrderByAggregateInput = {
    id?: SortOrder
    orderId?: SortOrder
    dressItemId?: SortOrder
    price?: SortOrder
    quantity?: SortOrder
    description?: SortOrder
    sizeText?: SortOrder
    repairs?: SortOrder
    basePrice?: SortOrder
    finalPrice?: SortOrder
    barcode?: SortOrder
    barcodePrefix?: SortOrder
    size?: SortOrder
    isTaken?: SortOrder
    isReturned?: SortOrder
    returnedOk?: SortOrder
    takenDate?: SortOrder
    returnDate?: SortOrder
    isDeleted?: SortOrder
    deletedAt?: SortOrder
    neckAlteration?: SortOrder
    lengthAlteration?: SortOrder
    sleeveAlteration?: SortOrder
    alterationDetails?: SortOrder
    alterationDone?: SortOrder
  }

  export type OrderItemSumOrderByAggregateInput = {
    id?: SortOrder
    orderId?: SortOrder
    dressItemId?: SortOrder
    price?: SortOrder
    quantity?: SortOrder
    basePrice?: SortOrder
    finalPrice?: SortOrder
    barcodePrefix?: SortOrder
    neckAlteration?: SortOrder
    sleeveAlteration?: SortOrder
  }

  export type PriceListCountOrderByAggregateInput = {
    id?: SortOrder
    description?: SortOrder
    fromSize?: SortOrder
    toSize?: SortOrder
    price?: SortOrder
    startDate?: SortOrder
    endDate?: SortOrder
    category?: SortOrder
    deposit?: SortOrder
  }

  export type PriceListAvgOrderByAggregateInput = {
    id?: SortOrder
    fromSize?: SortOrder
    toSize?: SortOrder
    price?: SortOrder
    deposit?: SortOrder
  }

  export type PriceListMaxOrderByAggregateInput = {
    id?: SortOrder
    description?: SortOrder
    fromSize?: SortOrder
    toSize?: SortOrder
    price?: SortOrder
    startDate?: SortOrder
    endDate?: SortOrder
    category?: SortOrder
    deposit?: SortOrder
  }

  export type PriceListMinOrderByAggregateInput = {
    id?: SortOrder
    description?: SortOrder
    fromSize?: SortOrder
    toSize?: SortOrder
    price?: SortOrder
    startDate?: SortOrder
    endDate?: SortOrder
    category?: SortOrder
    deposit?: SortOrder
  }

  export type PriceListSumOrderByAggregateInput = {
    id?: SortOrder
    fromSize?: SortOrder
    toSize?: SortOrder
    price?: SortOrder
    deposit?: SortOrder
  }

  export type SystemSettingCountOrderByAggregateInput = {
    id?: SortOrder
    key?: SortOrder
    value?: SortOrder
    name?: SortOrder
    category?: SortOrder
    notes?: SortOrder
    type?: SortOrder
  }

  export type SystemSettingAvgOrderByAggregateInput = {
    id?: SortOrder
  }

  export type SystemSettingMaxOrderByAggregateInput = {
    id?: SortOrder
    key?: SortOrder
    value?: SortOrder
    name?: SortOrder
    category?: SortOrder
    notes?: SortOrder
    type?: SortOrder
  }

  export type SystemSettingMinOrderByAggregateInput = {
    id?: SortOrder
    key?: SortOrder
    value?: SortOrder
    name?: SortOrder
    category?: SortOrder
    notes?: SortOrder
    type?: SortOrder
  }

  export type SystemSettingSumOrderByAggregateInput = {
    id?: SortOrder
  }

  export type PriceRuleCountOrderByAggregateInput = {
    id?: SortOrder
    description?: SortOrder
    minSize?: SortOrder
    maxSize?: SortOrder
    price?: SortOrder
    startDate?: SortOrder
    endDate?: SortOrder
    category?: SortOrder
    refund?: SortOrder
  }

  export type PriceRuleAvgOrderByAggregateInput = {
    id?: SortOrder
    minSize?: SortOrder
    maxSize?: SortOrder
    price?: SortOrder
    refund?: SortOrder
  }

  export type PriceRuleMaxOrderByAggregateInput = {
    id?: SortOrder
    description?: SortOrder
    minSize?: SortOrder
    maxSize?: SortOrder
    price?: SortOrder
    startDate?: SortOrder
    endDate?: SortOrder
    category?: SortOrder
    refund?: SortOrder
  }

  export type PriceRuleMinOrderByAggregateInput = {
    id?: SortOrder
    description?: SortOrder
    minSize?: SortOrder
    maxSize?: SortOrder
    price?: SortOrder
    startDate?: SortOrder
    endDate?: SortOrder
    category?: SortOrder
    refund?: SortOrder
  }

  export type PriceRuleSumOrderByAggregateInput = {
    id?: SortOrder
    minSize?: SortOrder
    maxSize?: SortOrder
    price?: SortOrder
    refund?: SortOrder
  }

  export type EmployeeNullableRelationFilter = {
    is?: EmployeeWhereInput | null
    isNot?: EmployeeWhereInput | null
  }

  export type PageVisitLogCountOrderByAggregateInput = {
    id?: SortOrder
    pageUrl?: SortOrder
    employeeId?: SortOrder
    employeeName?: SortOrder
    timestamp?: SortOrder
    loadingError?: SortOrder
    isGuest?: SortOrder
  }

  export type PageVisitLogAvgOrderByAggregateInput = {
    id?: SortOrder
    employeeId?: SortOrder
  }

  export type PageVisitLogMaxOrderByAggregateInput = {
    id?: SortOrder
    pageUrl?: SortOrder
    employeeId?: SortOrder
    employeeName?: SortOrder
    timestamp?: SortOrder
    loadingError?: SortOrder
    isGuest?: SortOrder
  }

  export type PageVisitLogMinOrderByAggregateInput = {
    id?: SortOrder
    pageUrl?: SortOrder
    employeeId?: SortOrder
    employeeName?: SortOrder
    timestamp?: SortOrder
    loadingError?: SortOrder
    isGuest?: SortOrder
  }

  export type PageVisitLogSumOrderByAggregateInput = {
    id?: SortOrder
    employeeId?: SortOrder
  }

  export type EmailLogCountOrderByAggregateInput = {
    id?: SortOrder
    to?: SortOrder
    cc?: SortOrder
    subject?: SortOrder
    body?: SortOrder
    fileName?: SortOrder
    status?: SortOrder
    errorMessage?: SortOrder
    customerId?: SortOrder
    employeeId?: SortOrder
    sentAt?: SortOrder
  }

  export type EmailLogAvgOrderByAggregateInput = {
    id?: SortOrder
    customerId?: SortOrder
    employeeId?: SortOrder
  }

  export type EmailLogMaxOrderByAggregateInput = {
    id?: SortOrder
    to?: SortOrder
    cc?: SortOrder
    subject?: SortOrder
    body?: SortOrder
    fileName?: SortOrder
    status?: SortOrder
    errorMessage?: SortOrder
    customerId?: SortOrder
    employeeId?: SortOrder
    sentAt?: SortOrder
  }

  export type EmailLogMinOrderByAggregateInput = {
    id?: SortOrder
    to?: SortOrder
    cc?: SortOrder
    subject?: SortOrder
    body?: SortOrder
    fileName?: SortOrder
    status?: SortOrder
    errorMessage?: SortOrder
    customerId?: SortOrder
    employeeId?: SortOrder
    sentAt?: SortOrder
  }

  export type EmailLogSumOrderByAggregateInput = {
    id?: SortOrder
    customerId?: SortOrder
    employeeId?: SortOrder
  }

  export type OrderCreateNestedManyWithoutCustomerInput = {
    create?: XOR<OrderCreateWithoutCustomerInput, OrderUncheckedCreateWithoutCustomerInput> | OrderCreateWithoutCustomerInput[] | OrderUncheckedCreateWithoutCustomerInput[]
    connectOrCreate?: OrderCreateOrConnectWithoutCustomerInput | OrderCreateOrConnectWithoutCustomerInput[]
    createMany?: OrderCreateManyCustomerInputEnvelope
    connect?: OrderWhereUniqueInput | OrderWhereUniqueInput[]
  }

  export type PaymentCreateNestedManyWithoutCustomerInput = {
    create?: XOR<PaymentCreateWithoutCustomerInput, PaymentUncheckedCreateWithoutCustomerInput> | PaymentCreateWithoutCustomerInput[] | PaymentUncheckedCreateWithoutCustomerInput[]
    connectOrCreate?: PaymentCreateOrConnectWithoutCustomerInput | PaymentCreateOrConnectWithoutCustomerInput[]
    createMany?: PaymentCreateManyCustomerInputEnvelope
    connect?: PaymentWhereUniqueInput | PaymentWhereUniqueInput[]
  }

  export type OrderUncheckedCreateNestedManyWithoutCustomerInput = {
    create?: XOR<OrderCreateWithoutCustomerInput, OrderUncheckedCreateWithoutCustomerInput> | OrderCreateWithoutCustomerInput[] | OrderUncheckedCreateWithoutCustomerInput[]
    connectOrCreate?: OrderCreateOrConnectWithoutCustomerInput | OrderCreateOrConnectWithoutCustomerInput[]
    createMany?: OrderCreateManyCustomerInputEnvelope
    connect?: OrderWhereUniqueInput | OrderWhereUniqueInput[]
  }

  export type PaymentUncheckedCreateNestedManyWithoutCustomerInput = {
    create?: XOR<PaymentCreateWithoutCustomerInput, PaymentUncheckedCreateWithoutCustomerInput> | PaymentCreateWithoutCustomerInput[] | PaymentUncheckedCreateWithoutCustomerInput[]
    connectOrCreate?: PaymentCreateOrConnectWithoutCustomerInput | PaymentCreateOrConnectWithoutCustomerInput[]
    createMany?: PaymentCreateManyCustomerInputEnvelope
    connect?: PaymentWhereUniqueInput | PaymentWhereUniqueInput[]
  }

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null
  }

  export type NullableIntFieldUpdateOperationsInput = {
    set?: number | null
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type BoolFieldUpdateOperationsInput = {
    set?: boolean
  }

  export type OrderUpdateManyWithoutCustomerNestedInput = {
    create?: XOR<OrderCreateWithoutCustomerInput, OrderUncheckedCreateWithoutCustomerInput> | OrderCreateWithoutCustomerInput[] | OrderUncheckedCreateWithoutCustomerInput[]
    connectOrCreate?: OrderCreateOrConnectWithoutCustomerInput | OrderCreateOrConnectWithoutCustomerInput[]
    upsert?: OrderUpsertWithWhereUniqueWithoutCustomerInput | OrderUpsertWithWhereUniqueWithoutCustomerInput[]
    createMany?: OrderCreateManyCustomerInputEnvelope
    set?: OrderWhereUniqueInput | OrderWhereUniqueInput[]
    disconnect?: OrderWhereUniqueInput | OrderWhereUniqueInput[]
    delete?: OrderWhereUniqueInput | OrderWhereUniqueInput[]
    connect?: OrderWhereUniqueInput | OrderWhereUniqueInput[]
    update?: OrderUpdateWithWhereUniqueWithoutCustomerInput | OrderUpdateWithWhereUniqueWithoutCustomerInput[]
    updateMany?: OrderUpdateManyWithWhereWithoutCustomerInput | OrderUpdateManyWithWhereWithoutCustomerInput[]
    deleteMany?: OrderScalarWhereInput | OrderScalarWhereInput[]
  }

  export type PaymentUpdateManyWithoutCustomerNestedInput = {
    create?: XOR<PaymentCreateWithoutCustomerInput, PaymentUncheckedCreateWithoutCustomerInput> | PaymentCreateWithoutCustomerInput[] | PaymentUncheckedCreateWithoutCustomerInput[]
    connectOrCreate?: PaymentCreateOrConnectWithoutCustomerInput | PaymentCreateOrConnectWithoutCustomerInput[]
    upsert?: PaymentUpsertWithWhereUniqueWithoutCustomerInput | PaymentUpsertWithWhereUniqueWithoutCustomerInput[]
    createMany?: PaymentCreateManyCustomerInputEnvelope
    set?: PaymentWhereUniqueInput | PaymentWhereUniqueInput[]
    disconnect?: PaymentWhereUniqueInput | PaymentWhereUniqueInput[]
    delete?: PaymentWhereUniqueInput | PaymentWhereUniqueInput[]
    connect?: PaymentWhereUniqueInput | PaymentWhereUniqueInput[]
    update?: PaymentUpdateWithWhereUniqueWithoutCustomerInput | PaymentUpdateWithWhereUniqueWithoutCustomerInput[]
    updateMany?: PaymentUpdateManyWithWhereWithoutCustomerInput | PaymentUpdateManyWithWhereWithoutCustomerInput[]
    deleteMany?: PaymentScalarWhereInput | PaymentScalarWhereInput[]
  }

  export type IntFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type OrderUncheckedUpdateManyWithoutCustomerNestedInput = {
    create?: XOR<OrderCreateWithoutCustomerInput, OrderUncheckedCreateWithoutCustomerInput> | OrderCreateWithoutCustomerInput[] | OrderUncheckedCreateWithoutCustomerInput[]
    connectOrCreate?: OrderCreateOrConnectWithoutCustomerInput | OrderCreateOrConnectWithoutCustomerInput[]
    upsert?: OrderUpsertWithWhereUniqueWithoutCustomerInput | OrderUpsertWithWhereUniqueWithoutCustomerInput[]
    createMany?: OrderCreateManyCustomerInputEnvelope
    set?: OrderWhereUniqueInput | OrderWhereUniqueInput[]
    disconnect?: OrderWhereUniqueInput | OrderWhereUniqueInput[]
    delete?: OrderWhereUniqueInput | OrderWhereUniqueInput[]
    connect?: OrderWhereUniqueInput | OrderWhereUniqueInput[]
    update?: OrderUpdateWithWhereUniqueWithoutCustomerInput | OrderUpdateWithWhereUniqueWithoutCustomerInput[]
    updateMany?: OrderUpdateManyWithWhereWithoutCustomerInput | OrderUpdateManyWithWhereWithoutCustomerInput[]
    deleteMany?: OrderScalarWhereInput | OrderScalarWhereInput[]
  }

  export type PaymentUncheckedUpdateManyWithoutCustomerNestedInput = {
    create?: XOR<PaymentCreateWithoutCustomerInput, PaymentUncheckedCreateWithoutCustomerInput> | PaymentCreateWithoutCustomerInput[] | PaymentUncheckedCreateWithoutCustomerInput[]
    connectOrCreate?: PaymentCreateOrConnectWithoutCustomerInput | PaymentCreateOrConnectWithoutCustomerInput[]
    upsert?: PaymentUpsertWithWhereUniqueWithoutCustomerInput | PaymentUpsertWithWhereUniqueWithoutCustomerInput[]
    createMany?: PaymentCreateManyCustomerInputEnvelope
    set?: PaymentWhereUniqueInput | PaymentWhereUniqueInput[]
    disconnect?: PaymentWhereUniqueInput | PaymentWhereUniqueInput[]
    delete?: PaymentWhereUniqueInput | PaymentWhereUniqueInput[]
    connect?: PaymentWhereUniqueInput | PaymentWhereUniqueInput[]
    update?: PaymentUpdateWithWhereUniqueWithoutCustomerInput | PaymentUpdateWithWhereUniqueWithoutCustomerInput[]
    updateMany?: PaymentUpdateManyWithWhereWithoutCustomerInput | PaymentUpdateManyWithWhereWithoutCustomerInput[]
    deleteMany?: PaymentScalarWhereInput | PaymentScalarWhereInput[]
  }

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string
  }

  export type PageVisitLogCreateNestedManyWithoutEmployeeInput = {
    create?: XOR<PageVisitLogCreateWithoutEmployeeInput, PageVisitLogUncheckedCreateWithoutEmployeeInput> | PageVisitLogCreateWithoutEmployeeInput[] | PageVisitLogUncheckedCreateWithoutEmployeeInput[]
    connectOrCreate?: PageVisitLogCreateOrConnectWithoutEmployeeInput | PageVisitLogCreateOrConnectWithoutEmployeeInput[]
    createMany?: PageVisitLogCreateManyEmployeeInputEnvelope
    connect?: PageVisitLogWhereUniqueInput | PageVisitLogWhereUniqueInput[]
  }

  export type ShiftCreateNestedManyWithoutEmployeeInput = {
    create?: XOR<ShiftCreateWithoutEmployeeInput, ShiftUncheckedCreateWithoutEmployeeInput> | ShiftCreateWithoutEmployeeInput[] | ShiftUncheckedCreateWithoutEmployeeInput[]
    connectOrCreate?: ShiftCreateOrConnectWithoutEmployeeInput | ShiftCreateOrConnectWithoutEmployeeInput[]
    createMany?: ShiftCreateManyEmployeeInputEnvelope
    connect?: ShiftWhereUniqueInput | ShiftWhereUniqueInput[]
  }

  export type PageVisitLogUncheckedCreateNestedManyWithoutEmployeeInput = {
    create?: XOR<PageVisitLogCreateWithoutEmployeeInput, PageVisitLogUncheckedCreateWithoutEmployeeInput> | PageVisitLogCreateWithoutEmployeeInput[] | PageVisitLogUncheckedCreateWithoutEmployeeInput[]
    connectOrCreate?: PageVisitLogCreateOrConnectWithoutEmployeeInput | PageVisitLogCreateOrConnectWithoutEmployeeInput[]
    createMany?: PageVisitLogCreateManyEmployeeInputEnvelope
    connect?: PageVisitLogWhereUniqueInput | PageVisitLogWhereUniqueInput[]
  }

  export type ShiftUncheckedCreateNestedManyWithoutEmployeeInput = {
    create?: XOR<ShiftCreateWithoutEmployeeInput, ShiftUncheckedCreateWithoutEmployeeInput> | ShiftCreateWithoutEmployeeInput[] | ShiftUncheckedCreateWithoutEmployeeInput[]
    connectOrCreate?: ShiftCreateOrConnectWithoutEmployeeInput | ShiftCreateOrConnectWithoutEmployeeInput[]
    createMany?: ShiftCreateManyEmployeeInputEnvelope
    connect?: ShiftWhereUniqueInput | ShiftWhereUniqueInput[]
  }

  export type NullableDateTimeFieldUpdateOperationsInput = {
    set?: Date | string | null
  }

  export type NullableFloatFieldUpdateOperationsInput = {
    set?: number | null
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type NullableBoolFieldUpdateOperationsInput = {
    set?: boolean | null
  }

  export type PageVisitLogUpdateManyWithoutEmployeeNestedInput = {
    create?: XOR<PageVisitLogCreateWithoutEmployeeInput, PageVisitLogUncheckedCreateWithoutEmployeeInput> | PageVisitLogCreateWithoutEmployeeInput[] | PageVisitLogUncheckedCreateWithoutEmployeeInput[]
    connectOrCreate?: PageVisitLogCreateOrConnectWithoutEmployeeInput | PageVisitLogCreateOrConnectWithoutEmployeeInput[]
    upsert?: PageVisitLogUpsertWithWhereUniqueWithoutEmployeeInput | PageVisitLogUpsertWithWhereUniqueWithoutEmployeeInput[]
    createMany?: PageVisitLogCreateManyEmployeeInputEnvelope
    set?: PageVisitLogWhereUniqueInput | PageVisitLogWhereUniqueInput[]
    disconnect?: PageVisitLogWhereUniqueInput | PageVisitLogWhereUniqueInput[]
    delete?: PageVisitLogWhereUniqueInput | PageVisitLogWhereUniqueInput[]
    connect?: PageVisitLogWhereUniqueInput | PageVisitLogWhereUniqueInput[]
    update?: PageVisitLogUpdateWithWhereUniqueWithoutEmployeeInput | PageVisitLogUpdateWithWhereUniqueWithoutEmployeeInput[]
    updateMany?: PageVisitLogUpdateManyWithWhereWithoutEmployeeInput | PageVisitLogUpdateManyWithWhereWithoutEmployeeInput[]
    deleteMany?: PageVisitLogScalarWhereInput | PageVisitLogScalarWhereInput[]
  }

  export type ShiftUpdateManyWithoutEmployeeNestedInput = {
    create?: XOR<ShiftCreateWithoutEmployeeInput, ShiftUncheckedCreateWithoutEmployeeInput> | ShiftCreateWithoutEmployeeInput[] | ShiftUncheckedCreateWithoutEmployeeInput[]
    connectOrCreate?: ShiftCreateOrConnectWithoutEmployeeInput | ShiftCreateOrConnectWithoutEmployeeInput[]
    upsert?: ShiftUpsertWithWhereUniqueWithoutEmployeeInput | ShiftUpsertWithWhereUniqueWithoutEmployeeInput[]
    createMany?: ShiftCreateManyEmployeeInputEnvelope
    set?: ShiftWhereUniqueInput | ShiftWhereUniqueInput[]
    disconnect?: ShiftWhereUniqueInput | ShiftWhereUniqueInput[]
    delete?: ShiftWhereUniqueInput | ShiftWhereUniqueInput[]
    connect?: ShiftWhereUniqueInput | ShiftWhereUniqueInput[]
    update?: ShiftUpdateWithWhereUniqueWithoutEmployeeInput | ShiftUpdateWithWhereUniqueWithoutEmployeeInput[]
    updateMany?: ShiftUpdateManyWithWhereWithoutEmployeeInput | ShiftUpdateManyWithWhereWithoutEmployeeInput[]
    deleteMany?: ShiftScalarWhereInput | ShiftScalarWhereInput[]
  }

  export type PageVisitLogUncheckedUpdateManyWithoutEmployeeNestedInput = {
    create?: XOR<PageVisitLogCreateWithoutEmployeeInput, PageVisitLogUncheckedCreateWithoutEmployeeInput> | PageVisitLogCreateWithoutEmployeeInput[] | PageVisitLogUncheckedCreateWithoutEmployeeInput[]
    connectOrCreate?: PageVisitLogCreateOrConnectWithoutEmployeeInput | PageVisitLogCreateOrConnectWithoutEmployeeInput[]
    upsert?: PageVisitLogUpsertWithWhereUniqueWithoutEmployeeInput | PageVisitLogUpsertWithWhereUniqueWithoutEmployeeInput[]
    createMany?: PageVisitLogCreateManyEmployeeInputEnvelope
    set?: PageVisitLogWhereUniqueInput | PageVisitLogWhereUniqueInput[]
    disconnect?: PageVisitLogWhereUniqueInput | PageVisitLogWhereUniqueInput[]
    delete?: PageVisitLogWhereUniqueInput | PageVisitLogWhereUniqueInput[]
    connect?: PageVisitLogWhereUniqueInput | PageVisitLogWhereUniqueInput[]
    update?: PageVisitLogUpdateWithWhereUniqueWithoutEmployeeInput | PageVisitLogUpdateWithWhereUniqueWithoutEmployeeInput[]
    updateMany?: PageVisitLogUpdateManyWithWhereWithoutEmployeeInput | PageVisitLogUpdateManyWithWhereWithoutEmployeeInput[]
    deleteMany?: PageVisitLogScalarWhereInput | PageVisitLogScalarWhereInput[]
  }

  export type ShiftUncheckedUpdateManyWithoutEmployeeNestedInput = {
    create?: XOR<ShiftCreateWithoutEmployeeInput, ShiftUncheckedCreateWithoutEmployeeInput> | ShiftCreateWithoutEmployeeInput[] | ShiftUncheckedCreateWithoutEmployeeInput[]
    connectOrCreate?: ShiftCreateOrConnectWithoutEmployeeInput | ShiftCreateOrConnectWithoutEmployeeInput[]
    upsert?: ShiftUpsertWithWhereUniqueWithoutEmployeeInput | ShiftUpsertWithWhereUniqueWithoutEmployeeInput[]
    createMany?: ShiftCreateManyEmployeeInputEnvelope
    set?: ShiftWhereUniqueInput | ShiftWhereUniqueInput[]
    disconnect?: ShiftWhereUniqueInput | ShiftWhereUniqueInput[]
    delete?: ShiftWhereUniqueInput | ShiftWhereUniqueInput[]
    connect?: ShiftWhereUniqueInput | ShiftWhereUniqueInput[]
    update?: ShiftUpdateWithWhereUniqueWithoutEmployeeInput | ShiftUpdateWithWhereUniqueWithoutEmployeeInput[]
    updateMany?: ShiftUpdateManyWithWhereWithoutEmployeeInput | ShiftUpdateManyWithWhereWithoutEmployeeInput[]
    deleteMany?: ShiftScalarWhereInput | ShiftScalarWhereInput[]
  }

  export type EmployeeCreateNestedOneWithoutShiftsInput = {
    create?: XOR<EmployeeCreateWithoutShiftsInput, EmployeeUncheckedCreateWithoutShiftsInput>
    connectOrCreate?: EmployeeCreateOrConnectWithoutShiftsInput
    connect?: EmployeeWhereUniqueInput
  }

  export type EmployeeUpdateOneRequiredWithoutShiftsNestedInput = {
    create?: XOR<EmployeeCreateWithoutShiftsInput, EmployeeUncheckedCreateWithoutShiftsInput>
    connectOrCreate?: EmployeeCreateOrConnectWithoutShiftsInput
    upsert?: EmployeeUpsertWithoutShiftsInput
    connect?: EmployeeWhereUniqueInput
    update?: XOR<XOR<EmployeeUpdateToOneWithWhereWithoutShiftsInput, EmployeeUpdateWithoutShiftsInput>, EmployeeUncheckedUpdateWithoutShiftsInput>
  }

  export type DressItemCreateNestedManyWithoutDressInput = {
    create?: XOR<DressItemCreateWithoutDressInput, DressItemUncheckedCreateWithoutDressInput> | DressItemCreateWithoutDressInput[] | DressItemUncheckedCreateWithoutDressInput[]
    connectOrCreate?: DressItemCreateOrConnectWithoutDressInput | DressItemCreateOrConnectWithoutDressInput[]
    createMany?: DressItemCreateManyDressInputEnvelope
    connect?: DressItemWhereUniqueInput | DressItemWhereUniqueInput[]
  }

  export type DressItemUncheckedCreateNestedManyWithoutDressInput = {
    create?: XOR<DressItemCreateWithoutDressInput, DressItemUncheckedCreateWithoutDressInput> | DressItemCreateWithoutDressInput[] | DressItemUncheckedCreateWithoutDressInput[]
    connectOrCreate?: DressItemCreateOrConnectWithoutDressInput | DressItemCreateOrConnectWithoutDressInput[]
    createMany?: DressItemCreateManyDressInputEnvelope
    connect?: DressItemWhereUniqueInput | DressItemWhereUniqueInput[]
  }

  export type DressItemUpdateManyWithoutDressNestedInput = {
    create?: XOR<DressItemCreateWithoutDressInput, DressItemUncheckedCreateWithoutDressInput> | DressItemCreateWithoutDressInput[] | DressItemUncheckedCreateWithoutDressInput[]
    connectOrCreate?: DressItemCreateOrConnectWithoutDressInput | DressItemCreateOrConnectWithoutDressInput[]
    upsert?: DressItemUpsertWithWhereUniqueWithoutDressInput | DressItemUpsertWithWhereUniqueWithoutDressInput[]
    createMany?: DressItemCreateManyDressInputEnvelope
    set?: DressItemWhereUniqueInput | DressItemWhereUniqueInput[]
    disconnect?: DressItemWhereUniqueInput | DressItemWhereUniqueInput[]
    delete?: DressItemWhereUniqueInput | DressItemWhereUniqueInput[]
    connect?: DressItemWhereUniqueInput | DressItemWhereUniqueInput[]
    update?: DressItemUpdateWithWhereUniqueWithoutDressInput | DressItemUpdateWithWhereUniqueWithoutDressInput[]
    updateMany?: DressItemUpdateManyWithWhereWithoutDressInput | DressItemUpdateManyWithWhereWithoutDressInput[]
    deleteMany?: DressItemScalarWhereInput | DressItemScalarWhereInput[]
  }

  export type DressItemUncheckedUpdateManyWithoutDressNestedInput = {
    create?: XOR<DressItemCreateWithoutDressInput, DressItemUncheckedCreateWithoutDressInput> | DressItemCreateWithoutDressInput[] | DressItemUncheckedCreateWithoutDressInput[]
    connectOrCreate?: DressItemCreateOrConnectWithoutDressInput | DressItemCreateOrConnectWithoutDressInput[]
    upsert?: DressItemUpsertWithWhereUniqueWithoutDressInput | DressItemUpsertWithWhereUniqueWithoutDressInput[]
    createMany?: DressItemCreateManyDressInputEnvelope
    set?: DressItemWhereUniqueInput | DressItemWhereUniqueInput[]
    disconnect?: DressItemWhereUniqueInput | DressItemWhereUniqueInput[]
    delete?: DressItemWhereUniqueInput | DressItemWhereUniqueInput[]
    connect?: DressItemWhereUniqueInput | DressItemWhereUniqueInput[]
    update?: DressItemUpdateWithWhereUniqueWithoutDressInput | DressItemUpdateWithWhereUniqueWithoutDressInput[]
    updateMany?: DressItemUpdateManyWithWhereWithoutDressInput | DressItemUpdateManyWithWhereWithoutDressInput[]
    deleteMany?: DressItemScalarWhereInput | DressItemScalarWhereInput[]
  }

  export type DressModelCreateNestedOneWithoutItemsInput = {
    create?: XOR<DressModelCreateWithoutItemsInput, DressModelUncheckedCreateWithoutItemsInput>
    connectOrCreate?: DressModelCreateOrConnectWithoutItemsInput
    connect?: DressModelWhereUniqueInput
  }

  export type OrderItemCreateNestedManyWithoutDressItemInput = {
    create?: XOR<OrderItemCreateWithoutDressItemInput, OrderItemUncheckedCreateWithoutDressItemInput> | OrderItemCreateWithoutDressItemInput[] | OrderItemUncheckedCreateWithoutDressItemInput[]
    connectOrCreate?: OrderItemCreateOrConnectWithoutDressItemInput | OrderItemCreateOrConnectWithoutDressItemInput[]
    createMany?: OrderItemCreateManyDressItemInputEnvelope
    connect?: OrderItemWhereUniqueInput | OrderItemWhereUniqueInput[]
  }

  export type OrderItemUncheckedCreateNestedManyWithoutDressItemInput = {
    create?: XOR<OrderItemCreateWithoutDressItemInput, OrderItemUncheckedCreateWithoutDressItemInput> | OrderItemCreateWithoutDressItemInput[] | OrderItemUncheckedCreateWithoutDressItemInput[]
    connectOrCreate?: OrderItemCreateOrConnectWithoutDressItemInput | OrderItemCreateOrConnectWithoutDressItemInput[]
    createMany?: OrderItemCreateManyDressItemInputEnvelope
    connect?: OrderItemWhereUniqueInput | OrderItemWhereUniqueInput[]
  }

  export type DressModelUpdateOneWithoutItemsNestedInput = {
    create?: XOR<DressModelCreateWithoutItemsInput, DressModelUncheckedCreateWithoutItemsInput>
    connectOrCreate?: DressModelCreateOrConnectWithoutItemsInput
    upsert?: DressModelUpsertWithoutItemsInput
    disconnect?: DressModelWhereInput | boolean
    delete?: DressModelWhereInput | boolean
    connect?: DressModelWhereUniqueInput
    update?: XOR<XOR<DressModelUpdateToOneWithWhereWithoutItemsInput, DressModelUpdateWithoutItemsInput>, DressModelUncheckedUpdateWithoutItemsInput>
  }

  export type OrderItemUpdateManyWithoutDressItemNestedInput = {
    create?: XOR<OrderItemCreateWithoutDressItemInput, OrderItemUncheckedCreateWithoutDressItemInput> | OrderItemCreateWithoutDressItemInput[] | OrderItemUncheckedCreateWithoutDressItemInput[]
    connectOrCreate?: OrderItemCreateOrConnectWithoutDressItemInput | OrderItemCreateOrConnectWithoutDressItemInput[]
    upsert?: OrderItemUpsertWithWhereUniqueWithoutDressItemInput | OrderItemUpsertWithWhereUniqueWithoutDressItemInput[]
    createMany?: OrderItemCreateManyDressItemInputEnvelope
    set?: OrderItemWhereUniqueInput | OrderItemWhereUniqueInput[]
    disconnect?: OrderItemWhereUniqueInput | OrderItemWhereUniqueInput[]
    delete?: OrderItemWhereUniqueInput | OrderItemWhereUniqueInput[]
    connect?: OrderItemWhereUniqueInput | OrderItemWhereUniqueInput[]
    update?: OrderItemUpdateWithWhereUniqueWithoutDressItemInput | OrderItemUpdateWithWhereUniqueWithoutDressItemInput[]
    updateMany?: OrderItemUpdateManyWithWhereWithoutDressItemInput | OrderItemUpdateManyWithWhereWithoutDressItemInput[]
    deleteMany?: OrderItemScalarWhereInput | OrderItemScalarWhereInput[]
  }

  export type OrderItemUncheckedUpdateManyWithoutDressItemNestedInput = {
    create?: XOR<OrderItemCreateWithoutDressItemInput, OrderItemUncheckedCreateWithoutDressItemInput> | OrderItemCreateWithoutDressItemInput[] | OrderItemUncheckedCreateWithoutDressItemInput[]
    connectOrCreate?: OrderItemCreateOrConnectWithoutDressItemInput | OrderItemCreateOrConnectWithoutDressItemInput[]
    upsert?: OrderItemUpsertWithWhereUniqueWithoutDressItemInput | OrderItemUpsertWithWhereUniqueWithoutDressItemInput[]
    createMany?: OrderItemCreateManyDressItemInputEnvelope
    set?: OrderItemWhereUniqueInput | OrderItemWhereUniqueInput[]
    disconnect?: OrderItemWhereUniqueInput | OrderItemWhereUniqueInput[]
    delete?: OrderItemWhereUniqueInput | OrderItemWhereUniqueInput[]
    connect?: OrderItemWhereUniqueInput | OrderItemWhereUniqueInput[]
    update?: OrderItemUpdateWithWhereUniqueWithoutDressItemInput | OrderItemUpdateWithWhereUniqueWithoutDressItemInput[]
    updateMany?: OrderItemUpdateManyWithWhereWithoutDressItemInput | OrderItemUpdateManyWithWhereWithoutDressItemInput[]
    deleteMany?: OrderItemScalarWhereInput | OrderItemScalarWhereInput[]
  }

  export type CustomerCreateNestedOneWithoutOrdersInput = {
    create?: XOR<CustomerCreateWithoutOrdersInput, CustomerUncheckedCreateWithoutOrdersInput>
    connectOrCreate?: CustomerCreateOrConnectWithoutOrdersInput
    connect?: CustomerWhereUniqueInput
  }

  export type OrderItemCreateNestedManyWithoutOrderInput = {
    create?: XOR<OrderItemCreateWithoutOrderInput, OrderItemUncheckedCreateWithoutOrderInput> | OrderItemCreateWithoutOrderInput[] | OrderItemUncheckedCreateWithoutOrderInput[]
    connectOrCreate?: OrderItemCreateOrConnectWithoutOrderInput | OrderItemCreateOrConnectWithoutOrderInput[]
    createMany?: OrderItemCreateManyOrderInputEnvelope
    connect?: OrderItemWhereUniqueInput | OrderItemWhereUniqueInput[]
  }

  export type PaymentCreateNestedManyWithoutOrderInput = {
    create?: XOR<PaymentCreateWithoutOrderInput, PaymentUncheckedCreateWithoutOrderInput> | PaymentCreateWithoutOrderInput[] | PaymentUncheckedCreateWithoutOrderInput[]
    connectOrCreate?: PaymentCreateOrConnectWithoutOrderInput | PaymentCreateOrConnectWithoutOrderInput[]
    createMany?: PaymentCreateManyOrderInputEnvelope
    connect?: PaymentWhereUniqueInput | PaymentWhereUniqueInput[]
  }

  export type PaymentObligationCreateNestedManyWithoutOrderInput = {
    create?: XOR<PaymentObligationCreateWithoutOrderInput, PaymentObligationUncheckedCreateWithoutOrderInput> | PaymentObligationCreateWithoutOrderInput[] | PaymentObligationUncheckedCreateWithoutOrderInput[]
    connectOrCreate?: PaymentObligationCreateOrConnectWithoutOrderInput | PaymentObligationCreateOrConnectWithoutOrderInput[]
    createMany?: PaymentObligationCreateManyOrderInputEnvelope
    connect?: PaymentObligationWhereUniqueInput | PaymentObligationWhereUniqueInput[]
  }

  export type OrderItemUncheckedCreateNestedManyWithoutOrderInput = {
    create?: XOR<OrderItemCreateWithoutOrderInput, OrderItemUncheckedCreateWithoutOrderInput> | OrderItemCreateWithoutOrderInput[] | OrderItemUncheckedCreateWithoutOrderInput[]
    connectOrCreate?: OrderItemCreateOrConnectWithoutOrderInput | OrderItemCreateOrConnectWithoutOrderInput[]
    createMany?: OrderItemCreateManyOrderInputEnvelope
    connect?: OrderItemWhereUniqueInput | OrderItemWhereUniqueInput[]
  }

  export type PaymentUncheckedCreateNestedManyWithoutOrderInput = {
    create?: XOR<PaymentCreateWithoutOrderInput, PaymentUncheckedCreateWithoutOrderInput> | PaymentCreateWithoutOrderInput[] | PaymentUncheckedCreateWithoutOrderInput[]
    connectOrCreate?: PaymentCreateOrConnectWithoutOrderInput | PaymentCreateOrConnectWithoutOrderInput[]
    createMany?: PaymentCreateManyOrderInputEnvelope
    connect?: PaymentWhereUniqueInput | PaymentWhereUniqueInput[]
  }

  export type PaymentObligationUncheckedCreateNestedManyWithoutOrderInput = {
    create?: XOR<PaymentObligationCreateWithoutOrderInput, PaymentObligationUncheckedCreateWithoutOrderInput> | PaymentObligationCreateWithoutOrderInput[] | PaymentObligationUncheckedCreateWithoutOrderInput[]
    connectOrCreate?: PaymentObligationCreateOrConnectWithoutOrderInput | PaymentObligationCreateOrConnectWithoutOrderInput[]
    createMany?: PaymentObligationCreateManyOrderInputEnvelope
    connect?: PaymentObligationWhereUniqueInput | PaymentObligationWhereUniqueInput[]
  }

  export type CustomerUpdateOneWithoutOrdersNestedInput = {
    create?: XOR<CustomerCreateWithoutOrdersInput, CustomerUncheckedCreateWithoutOrdersInput>
    connectOrCreate?: CustomerCreateOrConnectWithoutOrdersInput
    upsert?: CustomerUpsertWithoutOrdersInput
    disconnect?: CustomerWhereInput | boolean
    delete?: CustomerWhereInput | boolean
    connect?: CustomerWhereUniqueInput
    update?: XOR<XOR<CustomerUpdateToOneWithWhereWithoutOrdersInput, CustomerUpdateWithoutOrdersInput>, CustomerUncheckedUpdateWithoutOrdersInput>
  }

  export type OrderItemUpdateManyWithoutOrderNestedInput = {
    create?: XOR<OrderItemCreateWithoutOrderInput, OrderItemUncheckedCreateWithoutOrderInput> | OrderItemCreateWithoutOrderInput[] | OrderItemUncheckedCreateWithoutOrderInput[]
    connectOrCreate?: OrderItemCreateOrConnectWithoutOrderInput | OrderItemCreateOrConnectWithoutOrderInput[]
    upsert?: OrderItemUpsertWithWhereUniqueWithoutOrderInput | OrderItemUpsertWithWhereUniqueWithoutOrderInput[]
    createMany?: OrderItemCreateManyOrderInputEnvelope
    set?: OrderItemWhereUniqueInput | OrderItemWhereUniqueInput[]
    disconnect?: OrderItemWhereUniqueInput | OrderItemWhereUniqueInput[]
    delete?: OrderItemWhereUniqueInput | OrderItemWhereUniqueInput[]
    connect?: OrderItemWhereUniqueInput | OrderItemWhereUniqueInput[]
    update?: OrderItemUpdateWithWhereUniqueWithoutOrderInput | OrderItemUpdateWithWhereUniqueWithoutOrderInput[]
    updateMany?: OrderItemUpdateManyWithWhereWithoutOrderInput | OrderItemUpdateManyWithWhereWithoutOrderInput[]
    deleteMany?: OrderItemScalarWhereInput | OrderItemScalarWhereInput[]
  }

  export type PaymentUpdateManyWithoutOrderNestedInput = {
    create?: XOR<PaymentCreateWithoutOrderInput, PaymentUncheckedCreateWithoutOrderInput> | PaymentCreateWithoutOrderInput[] | PaymentUncheckedCreateWithoutOrderInput[]
    connectOrCreate?: PaymentCreateOrConnectWithoutOrderInput | PaymentCreateOrConnectWithoutOrderInput[]
    upsert?: PaymentUpsertWithWhereUniqueWithoutOrderInput | PaymentUpsertWithWhereUniqueWithoutOrderInput[]
    createMany?: PaymentCreateManyOrderInputEnvelope
    set?: PaymentWhereUniqueInput | PaymentWhereUniqueInput[]
    disconnect?: PaymentWhereUniqueInput | PaymentWhereUniqueInput[]
    delete?: PaymentWhereUniqueInput | PaymentWhereUniqueInput[]
    connect?: PaymentWhereUniqueInput | PaymentWhereUniqueInput[]
    update?: PaymentUpdateWithWhereUniqueWithoutOrderInput | PaymentUpdateWithWhereUniqueWithoutOrderInput[]
    updateMany?: PaymentUpdateManyWithWhereWithoutOrderInput | PaymentUpdateManyWithWhereWithoutOrderInput[]
    deleteMany?: PaymentScalarWhereInput | PaymentScalarWhereInput[]
  }

  export type PaymentObligationUpdateManyWithoutOrderNestedInput = {
    create?: XOR<PaymentObligationCreateWithoutOrderInput, PaymentObligationUncheckedCreateWithoutOrderInput> | PaymentObligationCreateWithoutOrderInput[] | PaymentObligationUncheckedCreateWithoutOrderInput[]
    connectOrCreate?: PaymentObligationCreateOrConnectWithoutOrderInput | PaymentObligationCreateOrConnectWithoutOrderInput[]
    upsert?: PaymentObligationUpsertWithWhereUniqueWithoutOrderInput | PaymentObligationUpsertWithWhereUniqueWithoutOrderInput[]
    createMany?: PaymentObligationCreateManyOrderInputEnvelope
    set?: PaymentObligationWhereUniqueInput | PaymentObligationWhereUniqueInput[]
    disconnect?: PaymentObligationWhereUniqueInput | PaymentObligationWhereUniqueInput[]
    delete?: PaymentObligationWhereUniqueInput | PaymentObligationWhereUniqueInput[]
    connect?: PaymentObligationWhereUniqueInput | PaymentObligationWhereUniqueInput[]
    update?: PaymentObligationUpdateWithWhereUniqueWithoutOrderInput | PaymentObligationUpdateWithWhereUniqueWithoutOrderInput[]
    updateMany?: PaymentObligationUpdateManyWithWhereWithoutOrderInput | PaymentObligationUpdateManyWithWhereWithoutOrderInput[]
    deleteMany?: PaymentObligationScalarWhereInput | PaymentObligationScalarWhereInput[]
  }

  export type OrderItemUncheckedUpdateManyWithoutOrderNestedInput = {
    create?: XOR<OrderItemCreateWithoutOrderInput, OrderItemUncheckedCreateWithoutOrderInput> | OrderItemCreateWithoutOrderInput[] | OrderItemUncheckedCreateWithoutOrderInput[]
    connectOrCreate?: OrderItemCreateOrConnectWithoutOrderInput | OrderItemCreateOrConnectWithoutOrderInput[]
    upsert?: OrderItemUpsertWithWhereUniqueWithoutOrderInput | OrderItemUpsertWithWhereUniqueWithoutOrderInput[]
    createMany?: OrderItemCreateManyOrderInputEnvelope
    set?: OrderItemWhereUniqueInput | OrderItemWhereUniqueInput[]
    disconnect?: OrderItemWhereUniqueInput | OrderItemWhereUniqueInput[]
    delete?: OrderItemWhereUniqueInput | OrderItemWhereUniqueInput[]
    connect?: OrderItemWhereUniqueInput | OrderItemWhereUniqueInput[]
    update?: OrderItemUpdateWithWhereUniqueWithoutOrderInput | OrderItemUpdateWithWhereUniqueWithoutOrderInput[]
    updateMany?: OrderItemUpdateManyWithWhereWithoutOrderInput | OrderItemUpdateManyWithWhereWithoutOrderInput[]
    deleteMany?: OrderItemScalarWhereInput | OrderItemScalarWhereInput[]
  }

  export type PaymentUncheckedUpdateManyWithoutOrderNestedInput = {
    create?: XOR<PaymentCreateWithoutOrderInput, PaymentUncheckedCreateWithoutOrderInput> | PaymentCreateWithoutOrderInput[] | PaymentUncheckedCreateWithoutOrderInput[]
    connectOrCreate?: PaymentCreateOrConnectWithoutOrderInput | PaymentCreateOrConnectWithoutOrderInput[]
    upsert?: PaymentUpsertWithWhereUniqueWithoutOrderInput | PaymentUpsertWithWhereUniqueWithoutOrderInput[]
    createMany?: PaymentCreateManyOrderInputEnvelope
    set?: PaymentWhereUniqueInput | PaymentWhereUniqueInput[]
    disconnect?: PaymentWhereUniqueInput | PaymentWhereUniqueInput[]
    delete?: PaymentWhereUniqueInput | PaymentWhereUniqueInput[]
    connect?: PaymentWhereUniqueInput | PaymentWhereUniqueInput[]
    update?: PaymentUpdateWithWhereUniqueWithoutOrderInput | PaymentUpdateWithWhereUniqueWithoutOrderInput[]
    updateMany?: PaymentUpdateManyWithWhereWithoutOrderInput | PaymentUpdateManyWithWhereWithoutOrderInput[]
    deleteMany?: PaymentScalarWhereInput | PaymentScalarWhereInput[]
  }

  export type PaymentObligationUncheckedUpdateManyWithoutOrderNestedInput = {
    create?: XOR<PaymentObligationCreateWithoutOrderInput, PaymentObligationUncheckedCreateWithoutOrderInput> | PaymentObligationCreateWithoutOrderInput[] | PaymentObligationUncheckedCreateWithoutOrderInput[]
    connectOrCreate?: PaymentObligationCreateOrConnectWithoutOrderInput | PaymentObligationCreateOrConnectWithoutOrderInput[]
    upsert?: PaymentObligationUpsertWithWhereUniqueWithoutOrderInput | PaymentObligationUpsertWithWhereUniqueWithoutOrderInput[]
    createMany?: PaymentObligationCreateManyOrderInputEnvelope
    set?: PaymentObligationWhereUniqueInput | PaymentObligationWhereUniqueInput[]
    disconnect?: PaymentObligationWhereUniqueInput | PaymentObligationWhereUniqueInput[]
    delete?: PaymentObligationWhereUniqueInput | PaymentObligationWhereUniqueInput[]
    connect?: PaymentObligationWhereUniqueInput | PaymentObligationWhereUniqueInput[]
    update?: PaymentObligationUpdateWithWhereUniqueWithoutOrderInput | PaymentObligationUpdateWithWhereUniqueWithoutOrderInput[]
    updateMany?: PaymentObligationUpdateManyWithWhereWithoutOrderInput | PaymentObligationUpdateManyWithWhereWithoutOrderInput[]
    deleteMany?: PaymentObligationScalarWhereInput | PaymentObligationScalarWhereInput[]
  }

  export type CustomerCreateNestedOneWithoutPaymentsInput = {
    create?: XOR<CustomerCreateWithoutPaymentsInput, CustomerUncheckedCreateWithoutPaymentsInput>
    connectOrCreate?: CustomerCreateOrConnectWithoutPaymentsInput
    connect?: CustomerWhereUniqueInput
  }

  export type OrderCreateNestedOneWithoutPaymentsInput = {
    create?: XOR<OrderCreateWithoutPaymentsInput, OrderUncheckedCreateWithoutPaymentsInput>
    connectOrCreate?: OrderCreateOrConnectWithoutPaymentsInput
    connect?: OrderWhereUniqueInput
  }

  export type FloatFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type CustomerUpdateOneWithoutPaymentsNestedInput = {
    create?: XOR<CustomerCreateWithoutPaymentsInput, CustomerUncheckedCreateWithoutPaymentsInput>
    connectOrCreate?: CustomerCreateOrConnectWithoutPaymentsInput
    upsert?: CustomerUpsertWithoutPaymentsInput
    disconnect?: CustomerWhereInput | boolean
    delete?: CustomerWhereInput | boolean
    connect?: CustomerWhereUniqueInput
    update?: XOR<XOR<CustomerUpdateToOneWithWhereWithoutPaymentsInput, CustomerUpdateWithoutPaymentsInput>, CustomerUncheckedUpdateWithoutPaymentsInput>
  }

  export type OrderUpdateOneWithoutPaymentsNestedInput = {
    create?: XOR<OrderCreateWithoutPaymentsInput, OrderUncheckedCreateWithoutPaymentsInput>
    connectOrCreate?: OrderCreateOrConnectWithoutPaymentsInput
    upsert?: OrderUpsertWithoutPaymentsInput
    disconnect?: OrderWhereInput | boolean
    delete?: OrderWhereInput | boolean
    connect?: OrderWhereUniqueInput
    update?: XOR<XOR<OrderUpdateToOneWithWhereWithoutPaymentsInput, OrderUpdateWithoutPaymentsInput>, OrderUncheckedUpdateWithoutPaymentsInput>
  }

  export type OrderCreateNestedOneWithoutObligationsInput = {
    create?: XOR<OrderCreateWithoutObligationsInput, OrderUncheckedCreateWithoutObligationsInput>
    connectOrCreate?: OrderCreateOrConnectWithoutObligationsInput
    connect?: OrderWhereUniqueInput
  }

  export type OrderUpdateOneRequiredWithoutObligationsNestedInput = {
    create?: XOR<OrderCreateWithoutObligationsInput, OrderUncheckedCreateWithoutObligationsInput>
    connectOrCreate?: OrderCreateOrConnectWithoutObligationsInput
    upsert?: OrderUpsertWithoutObligationsInput
    connect?: OrderWhereUniqueInput
    update?: XOR<XOR<OrderUpdateToOneWithWhereWithoutObligationsInput, OrderUpdateWithoutObligationsInput>, OrderUncheckedUpdateWithoutObligationsInput>
  }

  export type OrderCreateNestedOneWithoutItemsInput = {
    create?: XOR<OrderCreateWithoutItemsInput, OrderUncheckedCreateWithoutItemsInput>
    connectOrCreate?: OrderCreateOrConnectWithoutItemsInput
    connect?: OrderWhereUniqueInput
  }

  export type DressItemCreateNestedOneWithoutOrderItemsInput = {
    create?: XOR<DressItemCreateWithoutOrderItemsInput, DressItemUncheckedCreateWithoutOrderItemsInput>
    connectOrCreate?: DressItemCreateOrConnectWithoutOrderItemsInput
    connect?: DressItemWhereUniqueInput
  }

  export type OrderUpdateOneWithoutItemsNestedInput = {
    create?: XOR<OrderCreateWithoutItemsInput, OrderUncheckedCreateWithoutItemsInput>
    connectOrCreate?: OrderCreateOrConnectWithoutItemsInput
    upsert?: OrderUpsertWithoutItemsInput
    disconnect?: OrderWhereInput | boolean
    delete?: OrderWhereInput | boolean
    connect?: OrderWhereUniqueInput
    update?: XOR<XOR<OrderUpdateToOneWithWhereWithoutItemsInput, OrderUpdateWithoutItemsInput>, OrderUncheckedUpdateWithoutItemsInput>
  }

  export type DressItemUpdateOneWithoutOrderItemsNestedInput = {
    create?: XOR<DressItemCreateWithoutOrderItemsInput, DressItemUncheckedCreateWithoutOrderItemsInput>
    connectOrCreate?: DressItemCreateOrConnectWithoutOrderItemsInput
    upsert?: DressItemUpsertWithoutOrderItemsInput
    disconnect?: DressItemWhereInput | boolean
    delete?: DressItemWhereInput | boolean
    connect?: DressItemWhereUniqueInput
    update?: XOR<XOR<DressItemUpdateToOneWithWhereWithoutOrderItemsInput, DressItemUpdateWithoutOrderItemsInput>, DressItemUncheckedUpdateWithoutOrderItemsInput>
  }

  export type EmployeeCreateNestedOneWithoutPageVisitsInput = {
    create?: XOR<EmployeeCreateWithoutPageVisitsInput, EmployeeUncheckedCreateWithoutPageVisitsInput>
    connectOrCreate?: EmployeeCreateOrConnectWithoutPageVisitsInput
    connect?: EmployeeWhereUniqueInput
  }

  export type EmployeeUpdateOneWithoutPageVisitsNestedInput = {
    create?: XOR<EmployeeCreateWithoutPageVisitsInput, EmployeeUncheckedCreateWithoutPageVisitsInput>
    connectOrCreate?: EmployeeCreateOrConnectWithoutPageVisitsInput
    upsert?: EmployeeUpsertWithoutPageVisitsInput
    disconnect?: EmployeeWhereInput | boolean
    delete?: EmployeeWhereInput | boolean
    connect?: EmployeeWhereUniqueInput
    update?: XOR<XOR<EmployeeUpdateToOneWithWhereWithoutPageVisitsInput, EmployeeUpdateWithoutPageVisitsInput>, EmployeeUncheckedUpdateWithoutPageVisitsInput>
  }

  export type NestedIntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[]
    notIn?: number[]
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type NestedStringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | null
    notIn?: string[] | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type NestedIntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | null
    notIn?: number[] | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type NestedBoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type NestedIntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[]
    notIn?: number[]
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type NestedFloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[]
    notIn?: number[]
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }

  export type NestedStringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | null
    notIn?: string[] | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type NestedIntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | null
    notIn?: number[] | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedIntNullableFilter<$PrismaModel>
    _max?: NestedIntNullableFilter<$PrismaModel>
  }

  export type NestedFloatNullableFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | null
    notIn?: number[] | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableFilter<$PrismaModel> | number | null
  }

  export type NestedBoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type NestedStringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[]
    notIn?: string[]
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type NestedDateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[]
    notIn?: Date[] | string[]
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[]
    notIn?: string[]
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type NestedDateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[]
    notIn?: Date[] | string[]
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type NestedDateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | null
    notIn?: Date[] | string[] | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type NestedBoolNullableFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel> | null
    not?: NestedBoolNullableFilter<$PrismaModel> | boolean | null
  }

  export type NestedDateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | null
    notIn?: Date[] | string[] | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type NestedFloatNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | null
    notIn?: number[] | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedFloatNullableFilter<$PrismaModel>
    _min?: NestedFloatNullableFilter<$PrismaModel>
    _max?: NestedFloatNullableFilter<$PrismaModel>
  }

  export type NestedBoolNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel> | null
    not?: NestedBoolNullableWithAggregatesFilter<$PrismaModel> | boolean | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedBoolNullableFilter<$PrismaModel>
    _max?: NestedBoolNullableFilter<$PrismaModel>
  }

  export type NestedFloatWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[]
    notIn?: number[]
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedFloatFilter<$PrismaModel>
    _min?: NestedFloatFilter<$PrismaModel>
    _max?: NestedFloatFilter<$PrismaModel>
  }

  export type OrderCreateWithoutCustomerInput = {
    orderId: number
    totalAmount?: number | null
    paymentDate?: Date | string | null
    paymentMethod?: string | null
    status?: string | null
    notes?: string | null
    isPaid?: boolean
    isDeleted?: boolean
    orderNotes?: string | null
    eventDate?: Date | string | null
    eventDateHebrew?: string | null
    returnDate?: Date | string | null
    isWeekdayEvent?: boolean
    orderDate?: Date | string | null
    isAbroad?: boolean
    fromDate?: Date | string | null
    toDate?: Date | string | null
    items?: OrderItemCreateNestedManyWithoutOrderInput
    payments?: PaymentCreateNestedManyWithoutOrderInput
    obligations?: PaymentObligationCreateNestedManyWithoutOrderInput
  }

  export type OrderUncheckedCreateWithoutCustomerInput = {
    id?: number
    orderId: number
    totalAmount?: number | null
    paymentDate?: Date | string | null
    paymentMethod?: string | null
    status?: string | null
    notes?: string | null
    isPaid?: boolean
    isDeleted?: boolean
    orderNotes?: string | null
    eventDate?: Date | string | null
    eventDateHebrew?: string | null
    returnDate?: Date | string | null
    isWeekdayEvent?: boolean
    orderDate?: Date | string | null
    isAbroad?: boolean
    fromDate?: Date | string | null
    toDate?: Date | string | null
    items?: OrderItemUncheckedCreateNestedManyWithoutOrderInput
    payments?: PaymentUncheckedCreateNestedManyWithoutOrderInput
    obligations?: PaymentObligationUncheckedCreateNestedManyWithoutOrderInput
  }

  export type OrderCreateOrConnectWithoutCustomerInput = {
    where: OrderWhereUniqueInput
    create: XOR<OrderCreateWithoutCustomerInput, OrderUncheckedCreateWithoutCustomerInput>
  }

  export type OrderCreateManyCustomerInputEnvelope = {
    data: OrderCreateManyCustomerInput | OrderCreateManyCustomerInput[]
  }

  export type PaymentCreateWithoutCustomerInput = {
    amount: number
    paymentDate?: Date | string
    paymentMethod?: string | null
    notes?: string | null
    isDeleted?: boolean
    order?: OrderCreateNestedOneWithoutPaymentsInput
  }

  export type PaymentUncheckedCreateWithoutCustomerInput = {
    id?: number
    orderId?: number | null
    amount: number
    paymentDate?: Date | string
    paymentMethod?: string | null
    notes?: string | null
    isDeleted?: boolean
  }

  export type PaymentCreateOrConnectWithoutCustomerInput = {
    where: PaymentWhereUniqueInput
    create: XOR<PaymentCreateWithoutCustomerInput, PaymentUncheckedCreateWithoutCustomerInput>
  }

  export type PaymentCreateManyCustomerInputEnvelope = {
    data: PaymentCreateManyCustomerInput | PaymentCreateManyCustomerInput[]
  }

  export type OrderUpsertWithWhereUniqueWithoutCustomerInput = {
    where: OrderWhereUniqueInput
    update: XOR<OrderUpdateWithoutCustomerInput, OrderUncheckedUpdateWithoutCustomerInput>
    create: XOR<OrderCreateWithoutCustomerInput, OrderUncheckedCreateWithoutCustomerInput>
  }

  export type OrderUpdateWithWhereUniqueWithoutCustomerInput = {
    where: OrderWhereUniqueInput
    data: XOR<OrderUpdateWithoutCustomerInput, OrderUncheckedUpdateWithoutCustomerInput>
  }

  export type OrderUpdateManyWithWhereWithoutCustomerInput = {
    where: OrderScalarWhereInput
    data: XOR<OrderUpdateManyMutationInput, OrderUncheckedUpdateManyWithoutCustomerInput>
  }

  export type OrderScalarWhereInput = {
    AND?: OrderScalarWhereInput | OrderScalarWhereInput[]
    OR?: OrderScalarWhereInput[]
    NOT?: OrderScalarWhereInput | OrderScalarWhereInput[]
    id?: IntFilter<"Order"> | number
    orderId?: IntFilter<"Order"> | number
    customerId?: IntNullableFilter<"Order"> | number | null
    totalAmount?: FloatNullableFilter<"Order"> | number | null
    paymentDate?: DateTimeNullableFilter<"Order"> | Date | string | null
    paymentMethod?: StringNullableFilter<"Order"> | string | null
    status?: StringNullableFilter<"Order"> | string | null
    notes?: StringNullableFilter<"Order"> | string | null
    isPaid?: BoolFilter<"Order"> | boolean
    isDeleted?: BoolFilter<"Order"> | boolean
    orderNotes?: StringNullableFilter<"Order"> | string | null
    eventDate?: DateTimeNullableFilter<"Order"> | Date | string | null
    eventDateHebrew?: StringNullableFilter<"Order"> | string | null
    returnDate?: DateTimeNullableFilter<"Order"> | Date | string | null
    isWeekdayEvent?: BoolFilter<"Order"> | boolean
    orderDate?: DateTimeNullableFilter<"Order"> | Date | string | null
    isAbroad?: BoolFilter<"Order"> | boolean
    fromDate?: DateTimeNullableFilter<"Order"> | Date | string | null
    toDate?: DateTimeNullableFilter<"Order"> | Date | string | null
  }

  export type PaymentUpsertWithWhereUniqueWithoutCustomerInput = {
    where: PaymentWhereUniqueInput
    update: XOR<PaymentUpdateWithoutCustomerInput, PaymentUncheckedUpdateWithoutCustomerInput>
    create: XOR<PaymentCreateWithoutCustomerInput, PaymentUncheckedCreateWithoutCustomerInput>
  }

  export type PaymentUpdateWithWhereUniqueWithoutCustomerInput = {
    where: PaymentWhereUniqueInput
    data: XOR<PaymentUpdateWithoutCustomerInput, PaymentUncheckedUpdateWithoutCustomerInput>
  }

  export type PaymentUpdateManyWithWhereWithoutCustomerInput = {
    where: PaymentScalarWhereInput
    data: XOR<PaymentUpdateManyMutationInput, PaymentUncheckedUpdateManyWithoutCustomerInput>
  }

  export type PaymentScalarWhereInput = {
    AND?: PaymentScalarWhereInput | PaymentScalarWhereInput[]
    OR?: PaymentScalarWhereInput[]
    NOT?: PaymentScalarWhereInput | PaymentScalarWhereInput[]
    id?: IntFilter<"Payment"> | number
    customerId?: IntNullableFilter<"Payment"> | number | null
    orderId?: IntNullableFilter<"Payment"> | number | null
    amount?: FloatFilter<"Payment"> | number
    paymentDate?: DateTimeFilter<"Payment"> | Date | string
    paymentMethod?: StringNullableFilter<"Payment"> | string | null
    notes?: StringNullableFilter<"Payment"> | string | null
    isDeleted?: BoolFilter<"Payment"> | boolean
  }

  export type PageVisitLogCreateWithoutEmployeeInput = {
    pageUrl: string
    employeeName?: string | null
    timestamp?: Date | string
    loadingError?: string | null
    isGuest?: boolean
  }

  export type PageVisitLogUncheckedCreateWithoutEmployeeInput = {
    id?: number
    pageUrl: string
    employeeName?: string | null
    timestamp?: Date | string
    loadingError?: string | null
    isGuest?: boolean
  }

  export type PageVisitLogCreateOrConnectWithoutEmployeeInput = {
    where: PageVisitLogWhereUniqueInput
    create: XOR<PageVisitLogCreateWithoutEmployeeInput, PageVisitLogUncheckedCreateWithoutEmployeeInput>
  }

  export type PageVisitLogCreateManyEmployeeInputEnvelope = {
    data: PageVisitLogCreateManyEmployeeInput | PageVisitLogCreateManyEmployeeInput[]
  }

  export type ShiftCreateWithoutEmployeeInput = {
    entryTime?: Date | string | null
    exitTime?: Date | string | null
    hebrewDate?: string | null
    date?: Date | string | null
    totalMinutes?: number | null
    hourlyWageSnapshot?: number | null
    travelExpensesSnapshot?: number | null
    totalCalculated?: number | null
    paymentMethod?: string | null
    notes?: string | null
    isDeleted?: boolean
  }

  export type ShiftUncheckedCreateWithoutEmployeeInput = {
    id?: number
    entryTime?: Date | string | null
    exitTime?: Date | string | null
    hebrewDate?: string | null
    date?: Date | string | null
    totalMinutes?: number | null
    hourlyWageSnapshot?: number | null
    travelExpensesSnapshot?: number | null
    totalCalculated?: number | null
    paymentMethod?: string | null
    notes?: string | null
    isDeleted?: boolean
  }

  export type ShiftCreateOrConnectWithoutEmployeeInput = {
    where: ShiftWhereUniqueInput
    create: XOR<ShiftCreateWithoutEmployeeInput, ShiftUncheckedCreateWithoutEmployeeInput>
  }

  export type ShiftCreateManyEmployeeInputEnvelope = {
    data: ShiftCreateManyEmployeeInput | ShiftCreateManyEmployeeInput[]
  }

  export type PageVisitLogUpsertWithWhereUniqueWithoutEmployeeInput = {
    where: PageVisitLogWhereUniqueInput
    update: XOR<PageVisitLogUpdateWithoutEmployeeInput, PageVisitLogUncheckedUpdateWithoutEmployeeInput>
    create: XOR<PageVisitLogCreateWithoutEmployeeInput, PageVisitLogUncheckedCreateWithoutEmployeeInput>
  }

  export type PageVisitLogUpdateWithWhereUniqueWithoutEmployeeInput = {
    where: PageVisitLogWhereUniqueInput
    data: XOR<PageVisitLogUpdateWithoutEmployeeInput, PageVisitLogUncheckedUpdateWithoutEmployeeInput>
  }

  export type PageVisitLogUpdateManyWithWhereWithoutEmployeeInput = {
    where: PageVisitLogScalarWhereInput
    data: XOR<PageVisitLogUpdateManyMutationInput, PageVisitLogUncheckedUpdateManyWithoutEmployeeInput>
  }

  export type PageVisitLogScalarWhereInput = {
    AND?: PageVisitLogScalarWhereInput | PageVisitLogScalarWhereInput[]
    OR?: PageVisitLogScalarWhereInput[]
    NOT?: PageVisitLogScalarWhereInput | PageVisitLogScalarWhereInput[]
    id?: IntFilter<"PageVisitLog"> | number
    pageUrl?: StringFilter<"PageVisitLog"> | string
    employeeId?: IntNullableFilter<"PageVisitLog"> | number | null
    employeeName?: StringNullableFilter<"PageVisitLog"> | string | null
    timestamp?: DateTimeFilter<"PageVisitLog"> | Date | string
    loadingError?: StringNullableFilter<"PageVisitLog"> | string | null
    isGuest?: BoolFilter<"PageVisitLog"> | boolean
  }

  export type ShiftUpsertWithWhereUniqueWithoutEmployeeInput = {
    where: ShiftWhereUniqueInput
    update: XOR<ShiftUpdateWithoutEmployeeInput, ShiftUncheckedUpdateWithoutEmployeeInput>
    create: XOR<ShiftCreateWithoutEmployeeInput, ShiftUncheckedCreateWithoutEmployeeInput>
  }

  export type ShiftUpdateWithWhereUniqueWithoutEmployeeInput = {
    where: ShiftWhereUniqueInput
    data: XOR<ShiftUpdateWithoutEmployeeInput, ShiftUncheckedUpdateWithoutEmployeeInput>
  }

  export type ShiftUpdateManyWithWhereWithoutEmployeeInput = {
    where: ShiftScalarWhereInput
    data: XOR<ShiftUpdateManyMutationInput, ShiftUncheckedUpdateManyWithoutEmployeeInput>
  }

  export type ShiftScalarWhereInput = {
    AND?: ShiftScalarWhereInput | ShiftScalarWhereInput[]
    OR?: ShiftScalarWhereInput[]
    NOT?: ShiftScalarWhereInput | ShiftScalarWhereInput[]
    id?: IntFilter<"Shift"> | number
    employeeId?: IntFilter<"Shift"> | number
    entryTime?: DateTimeNullableFilter<"Shift"> | Date | string | null
    exitTime?: DateTimeNullableFilter<"Shift"> | Date | string | null
    hebrewDate?: StringNullableFilter<"Shift"> | string | null
    date?: DateTimeNullableFilter<"Shift"> | Date | string | null
    totalMinutes?: IntNullableFilter<"Shift"> | number | null
    hourlyWageSnapshot?: FloatNullableFilter<"Shift"> | number | null
    travelExpensesSnapshot?: FloatNullableFilter<"Shift"> | number | null
    totalCalculated?: FloatNullableFilter<"Shift"> | number | null
    paymentMethod?: StringNullableFilter<"Shift"> | string | null
    notes?: StringNullableFilter<"Shift"> | string | null
    isDeleted?: BoolFilter<"Shift"> | boolean
  }

  export type EmployeeCreateWithoutShiftsInput = {
    firstName?: string | null
    lastName?: string | null
    phone1?: string | null
    phone2?: string | null
    city?: string | null
    street?: string | null
    houseNum?: string | null
    email?: string | null
    joinDate?: Date | string | null
    fullName?: string | null
    notes?: string | null
    emailSuffix?: string | null
    roleId?: number | null
    password?: string | null
    isActive?: boolean
    hourlyWage?: number | null
    paymentMethod?: string | null
    travelExpenses?: boolean | null
    pageVisits?: PageVisitLogCreateNestedManyWithoutEmployeeInput
  }

  export type EmployeeUncheckedCreateWithoutShiftsInput = {
    id?: number
    firstName?: string | null
    lastName?: string | null
    phone1?: string | null
    phone2?: string | null
    city?: string | null
    street?: string | null
    houseNum?: string | null
    email?: string | null
    joinDate?: Date | string | null
    fullName?: string | null
    notes?: string | null
    emailSuffix?: string | null
    roleId?: number | null
    password?: string | null
    isActive?: boolean
    hourlyWage?: number | null
    paymentMethod?: string | null
    travelExpenses?: boolean | null
    pageVisits?: PageVisitLogUncheckedCreateNestedManyWithoutEmployeeInput
  }

  export type EmployeeCreateOrConnectWithoutShiftsInput = {
    where: EmployeeWhereUniqueInput
    create: XOR<EmployeeCreateWithoutShiftsInput, EmployeeUncheckedCreateWithoutShiftsInput>
  }

  export type EmployeeUpsertWithoutShiftsInput = {
    update: XOR<EmployeeUpdateWithoutShiftsInput, EmployeeUncheckedUpdateWithoutShiftsInput>
    create: XOR<EmployeeCreateWithoutShiftsInput, EmployeeUncheckedCreateWithoutShiftsInput>
    where?: EmployeeWhereInput
  }

  export type EmployeeUpdateToOneWithWhereWithoutShiftsInput = {
    where?: EmployeeWhereInput
    data: XOR<EmployeeUpdateWithoutShiftsInput, EmployeeUncheckedUpdateWithoutShiftsInput>
  }

  export type EmployeeUpdateWithoutShiftsInput = {
    firstName?: NullableStringFieldUpdateOperationsInput | string | null
    lastName?: NullableStringFieldUpdateOperationsInput | string | null
    phone1?: NullableStringFieldUpdateOperationsInput | string | null
    phone2?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    street?: NullableStringFieldUpdateOperationsInput | string | null
    houseNum?: NullableStringFieldUpdateOperationsInput | string | null
    email?: NullableStringFieldUpdateOperationsInput | string | null
    joinDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    fullName?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    emailSuffix?: NullableStringFieldUpdateOperationsInput | string | null
    roleId?: NullableIntFieldUpdateOperationsInput | number | null
    password?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    hourlyWage?: NullableFloatFieldUpdateOperationsInput | number | null
    paymentMethod?: NullableStringFieldUpdateOperationsInput | string | null
    travelExpenses?: NullableBoolFieldUpdateOperationsInput | boolean | null
    pageVisits?: PageVisitLogUpdateManyWithoutEmployeeNestedInput
  }

  export type EmployeeUncheckedUpdateWithoutShiftsInput = {
    id?: IntFieldUpdateOperationsInput | number
    firstName?: NullableStringFieldUpdateOperationsInput | string | null
    lastName?: NullableStringFieldUpdateOperationsInput | string | null
    phone1?: NullableStringFieldUpdateOperationsInput | string | null
    phone2?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    street?: NullableStringFieldUpdateOperationsInput | string | null
    houseNum?: NullableStringFieldUpdateOperationsInput | string | null
    email?: NullableStringFieldUpdateOperationsInput | string | null
    joinDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    fullName?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    emailSuffix?: NullableStringFieldUpdateOperationsInput | string | null
    roleId?: NullableIntFieldUpdateOperationsInput | number | null
    password?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    hourlyWage?: NullableFloatFieldUpdateOperationsInput | number | null
    paymentMethod?: NullableStringFieldUpdateOperationsInput | string | null
    travelExpenses?: NullableBoolFieldUpdateOperationsInput | boolean | null
    pageVisits?: PageVisitLogUncheckedUpdateManyWithoutEmployeeNestedInput
  }

  export type DressItemCreateWithoutDressInput = {
    barcodePrefix?: number | null
    dressName?: string | null
    sizeText?: string | null
    serialNumber?: number | null
    dressBarcode?: string | null
    location?: string | null
    locationNum?: number | null
    quantity?: number | null
    inRepair?: boolean
    notInUse?: boolean
    notInUseSince?: Date | string | null
    entryDateToRepo?: Date | string | null
    isDeleted?: boolean
    deletedAt?: Date | string | null
    orderItems?: OrderItemCreateNestedManyWithoutDressItemInput
  }

  export type DressItemUncheckedCreateWithoutDressInput = {
    id?: number
    barcodePrefix?: number | null
    dressName?: string | null
    sizeText?: string | null
    serialNumber?: number | null
    dressBarcode?: string | null
    location?: string | null
    locationNum?: number | null
    quantity?: number | null
    inRepair?: boolean
    notInUse?: boolean
    notInUseSince?: Date | string | null
    entryDateToRepo?: Date | string | null
    isDeleted?: boolean
    deletedAt?: Date | string | null
    orderItems?: OrderItemUncheckedCreateNestedManyWithoutDressItemInput
  }

  export type DressItemCreateOrConnectWithoutDressInput = {
    where: DressItemWhereUniqueInput
    create: XOR<DressItemCreateWithoutDressInput, DressItemUncheckedCreateWithoutDressInput>
  }

  export type DressItemCreateManyDressInputEnvelope = {
    data: DressItemCreateManyDressInput | DressItemCreateManyDressInput[]
  }

  export type DressItemUpsertWithWhereUniqueWithoutDressInput = {
    where: DressItemWhereUniqueInput
    update: XOR<DressItemUpdateWithoutDressInput, DressItemUncheckedUpdateWithoutDressInput>
    create: XOR<DressItemCreateWithoutDressInput, DressItemUncheckedCreateWithoutDressInput>
  }

  export type DressItemUpdateWithWhereUniqueWithoutDressInput = {
    where: DressItemWhereUniqueInput
    data: XOR<DressItemUpdateWithoutDressInput, DressItemUncheckedUpdateWithoutDressInput>
  }

  export type DressItemUpdateManyWithWhereWithoutDressInput = {
    where: DressItemScalarWhereInput
    data: XOR<DressItemUpdateManyMutationInput, DressItemUncheckedUpdateManyWithoutDressInput>
  }

  export type DressItemScalarWhereInput = {
    AND?: DressItemScalarWhereInput | DressItemScalarWhereInput[]
    OR?: DressItemScalarWhereInput[]
    NOT?: DressItemScalarWhereInput | DressItemScalarWhereInput[]
    id?: IntFilter<"DressItem"> | number
    barcodePrefix?: IntNullableFilter<"DressItem"> | number | null
    dressModelId?: IntNullableFilter<"DressItem"> | number | null
    dressName?: StringNullableFilter<"DressItem"> | string | null
    sizeText?: StringNullableFilter<"DressItem"> | string | null
    serialNumber?: IntNullableFilter<"DressItem"> | number | null
    dressBarcode?: StringNullableFilter<"DressItem"> | string | null
    location?: StringNullableFilter<"DressItem"> | string | null
    locationNum?: IntNullableFilter<"DressItem"> | number | null
    quantity?: IntNullableFilter<"DressItem"> | number | null
    inRepair?: BoolFilter<"DressItem"> | boolean
    notInUse?: BoolFilter<"DressItem"> | boolean
    notInUseSince?: DateTimeNullableFilter<"DressItem"> | Date | string | null
    entryDateToRepo?: DateTimeNullableFilter<"DressItem"> | Date | string | null
    isDeleted?: BoolFilter<"DressItem"> | boolean
    deletedAt?: DateTimeNullableFilter<"DressItem"> | Date | string | null
  }

  export type DressModelCreateWithoutItemsInput = {
    name?: string | null
    barcodePrefix?: number | null
    priceCategory?: string | null
    notes?: string | null
    inInspection?: boolean
    imageUrl?: string | null
    entryDateToRepo?: Date | string | null
    exitDateFromRepo?: Date | string | null
    isDeleted?: boolean
    deletedAt?: Date | string | null
  }

  export type DressModelUncheckedCreateWithoutItemsInput = {
    id?: number
    name?: string | null
    barcodePrefix?: number | null
    priceCategory?: string | null
    notes?: string | null
    inInspection?: boolean
    imageUrl?: string | null
    entryDateToRepo?: Date | string | null
    exitDateFromRepo?: Date | string | null
    isDeleted?: boolean
    deletedAt?: Date | string | null
  }

  export type DressModelCreateOrConnectWithoutItemsInput = {
    where: DressModelWhereUniqueInput
    create: XOR<DressModelCreateWithoutItemsInput, DressModelUncheckedCreateWithoutItemsInput>
  }

  export type OrderItemCreateWithoutDressItemInput = {
    price?: number | null
    quantity?: number | null
    description?: string | null
    sizeText?: string | null
    repairs?: string | null
    basePrice?: number | null
    finalPrice?: number | null
    barcode?: string | null
    barcodePrefix?: number | null
    size?: string | null
    isTaken?: boolean
    isReturned?: boolean
    returnedOk?: boolean
    takenDate?: Date | string | null
    returnDate?: Date | string | null
    isDeleted?: boolean
    deletedAt?: Date | string | null
    neckAlteration?: number | null
    lengthAlteration?: string | null
    sleeveAlteration?: number | null
    alterationDetails?: string | null
    alterationDone?: boolean
    order?: OrderCreateNestedOneWithoutItemsInput
  }

  export type OrderItemUncheckedCreateWithoutDressItemInput = {
    id?: number
    orderId?: number | null
    price?: number | null
    quantity?: number | null
    description?: string | null
    sizeText?: string | null
    repairs?: string | null
    basePrice?: number | null
    finalPrice?: number | null
    barcode?: string | null
    barcodePrefix?: number | null
    size?: string | null
    isTaken?: boolean
    isReturned?: boolean
    returnedOk?: boolean
    takenDate?: Date | string | null
    returnDate?: Date | string | null
    isDeleted?: boolean
    deletedAt?: Date | string | null
    neckAlteration?: number | null
    lengthAlteration?: string | null
    sleeveAlteration?: number | null
    alterationDetails?: string | null
    alterationDone?: boolean
  }

  export type OrderItemCreateOrConnectWithoutDressItemInput = {
    where: OrderItemWhereUniqueInput
    create: XOR<OrderItemCreateWithoutDressItemInput, OrderItemUncheckedCreateWithoutDressItemInput>
  }

  export type OrderItemCreateManyDressItemInputEnvelope = {
    data: OrderItemCreateManyDressItemInput | OrderItemCreateManyDressItemInput[]
  }

  export type DressModelUpsertWithoutItemsInput = {
    update: XOR<DressModelUpdateWithoutItemsInput, DressModelUncheckedUpdateWithoutItemsInput>
    create: XOR<DressModelCreateWithoutItemsInput, DressModelUncheckedCreateWithoutItemsInput>
    where?: DressModelWhereInput
  }

  export type DressModelUpdateToOneWithWhereWithoutItemsInput = {
    where?: DressModelWhereInput
    data: XOR<DressModelUpdateWithoutItemsInput, DressModelUncheckedUpdateWithoutItemsInput>
  }

  export type DressModelUpdateWithoutItemsInput = {
    name?: NullableStringFieldUpdateOperationsInput | string | null
    barcodePrefix?: NullableIntFieldUpdateOperationsInput | number | null
    priceCategory?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    inInspection?: BoolFieldUpdateOperationsInput | boolean
    imageUrl?: NullableStringFieldUpdateOperationsInput | string | null
    entryDateToRepo?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    exitDateFromRepo?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type DressModelUncheckedUpdateWithoutItemsInput = {
    id?: IntFieldUpdateOperationsInput | number
    name?: NullableStringFieldUpdateOperationsInput | string | null
    barcodePrefix?: NullableIntFieldUpdateOperationsInput | number | null
    priceCategory?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    inInspection?: BoolFieldUpdateOperationsInput | boolean
    imageUrl?: NullableStringFieldUpdateOperationsInput | string | null
    entryDateToRepo?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    exitDateFromRepo?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type OrderItemUpsertWithWhereUniqueWithoutDressItemInput = {
    where: OrderItemWhereUniqueInput
    update: XOR<OrderItemUpdateWithoutDressItemInput, OrderItemUncheckedUpdateWithoutDressItemInput>
    create: XOR<OrderItemCreateWithoutDressItemInput, OrderItemUncheckedCreateWithoutDressItemInput>
  }

  export type OrderItemUpdateWithWhereUniqueWithoutDressItemInput = {
    where: OrderItemWhereUniqueInput
    data: XOR<OrderItemUpdateWithoutDressItemInput, OrderItemUncheckedUpdateWithoutDressItemInput>
  }

  export type OrderItemUpdateManyWithWhereWithoutDressItemInput = {
    where: OrderItemScalarWhereInput
    data: XOR<OrderItemUpdateManyMutationInput, OrderItemUncheckedUpdateManyWithoutDressItemInput>
  }

  export type OrderItemScalarWhereInput = {
    AND?: OrderItemScalarWhereInput | OrderItemScalarWhereInput[]
    OR?: OrderItemScalarWhereInput[]
    NOT?: OrderItemScalarWhereInput | OrderItemScalarWhereInput[]
    id?: IntFilter<"OrderItem"> | number
    orderId?: IntNullableFilter<"OrderItem"> | number | null
    dressItemId?: IntNullableFilter<"OrderItem"> | number | null
    price?: FloatNullableFilter<"OrderItem"> | number | null
    quantity?: IntNullableFilter<"OrderItem"> | number | null
    description?: StringNullableFilter<"OrderItem"> | string | null
    sizeText?: StringNullableFilter<"OrderItem"> | string | null
    repairs?: StringNullableFilter<"OrderItem"> | string | null
    basePrice?: FloatNullableFilter<"OrderItem"> | number | null
    finalPrice?: FloatNullableFilter<"OrderItem"> | number | null
    barcode?: StringNullableFilter<"OrderItem"> | string | null
    barcodePrefix?: IntNullableFilter<"OrderItem"> | number | null
    size?: StringNullableFilter<"OrderItem"> | string | null
    isTaken?: BoolFilter<"OrderItem"> | boolean
    isReturned?: BoolFilter<"OrderItem"> | boolean
    returnedOk?: BoolFilter<"OrderItem"> | boolean
    takenDate?: DateTimeNullableFilter<"OrderItem"> | Date | string | null
    returnDate?: DateTimeNullableFilter<"OrderItem"> | Date | string | null
    isDeleted?: BoolFilter<"OrderItem"> | boolean
    deletedAt?: DateTimeNullableFilter<"OrderItem"> | Date | string | null
    neckAlteration?: IntNullableFilter<"OrderItem"> | number | null
    lengthAlteration?: StringNullableFilter<"OrderItem"> | string | null
    sleeveAlteration?: IntNullableFilter<"OrderItem"> | number | null
    alterationDetails?: StringNullableFilter<"OrderItem"> | string | null
    alterationDone?: BoolFilter<"OrderItem"> | boolean
  }

  export type CustomerCreateWithoutOrdersInput = {
    firstName?: string | null
    lastName?: string | null
    phone1?: string | null
    phone2?: string | null
    city?: string | null
    street?: string | null
    houseNum?: number | null
    email?: string | null
    emailSuffix?: string | null
    notes?: string | null
    registrationDate?: string | null
    officeNotes?: string | null
    isDeleted?: boolean
    payments?: PaymentCreateNestedManyWithoutCustomerInput
  }

  export type CustomerUncheckedCreateWithoutOrdersInput = {
    id?: number
    firstName?: string | null
    lastName?: string | null
    phone1?: string | null
    phone2?: string | null
    city?: string | null
    street?: string | null
    houseNum?: number | null
    email?: string | null
    emailSuffix?: string | null
    notes?: string | null
    registrationDate?: string | null
    officeNotes?: string | null
    isDeleted?: boolean
    payments?: PaymentUncheckedCreateNestedManyWithoutCustomerInput
  }

  export type CustomerCreateOrConnectWithoutOrdersInput = {
    where: CustomerWhereUniqueInput
    create: XOR<CustomerCreateWithoutOrdersInput, CustomerUncheckedCreateWithoutOrdersInput>
  }

  export type OrderItemCreateWithoutOrderInput = {
    price?: number | null
    quantity?: number | null
    description?: string | null
    sizeText?: string | null
    repairs?: string | null
    basePrice?: number | null
    finalPrice?: number | null
    barcode?: string | null
    barcodePrefix?: number | null
    size?: string | null
    isTaken?: boolean
    isReturned?: boolean
    returnedOk?: boolean
    takenDate?: Date | string | null
    returnDate?: Date | string | null
    isDeleted?: boolean
    deletedAt?: Date | string | null
    neckAlteration?: number | null
    lengthAlteration?: string | null
    sleeveAlteration?: number | null
    alterationDetails?: string | null
    alterationDone?: boolean
    dressItem?: DressItemCreateNestedOneWithoutOrderItemsInput
  }

  export type OrderItemUncheckedCreateWithoutOrderInput = {
    id?: number
    dressItemId?: number | null
    price?: number | null
    quantity?: number | null
    description?: string | null
    sizeText?: string | null
    repairs?: string | null
    basePrice?: number | null
    finalPrice?: number | null
    barcode?: string | null
    barcodePrefix?: number | null
    size?: string | null
    isTaken?: boolean
    isReturned?: boolean
    returnedOk?: boolean
    takenDate?: Date | string | null
    returnDate?: Date | string | null
    isDeleted?: boolean
    deletedAt?: Date | string | null
    neckAlteration?: number | null
    lengthAlteration?: string | null
    sleeveAlteration?: number | null
    alterationDetails?: string | null
    alterationDone?: boolean
  }

  export type OrderItemCreateOrConnectWithoutOrderInput = {
    where: OrderItemWhereUniqueInput
    create: XOR<OrderItemCreateWithoutOrderInput, OrderItemUncheckedCreateWithoutOrderInput>
  }

  export type OrderItemCreateManyOrderInputEnvelope = {
    data: OrderItemCreateManyOrderInput | OrderItemCreateManyOrderInput[]
  }

  export type PaymentCreateWithoutOrderInput = {
    amount: number
    paymentDate?: Date | string
    paymentMethod?: string | null
    notes?: string | null
    isDeleted?: boolean
    customer?: CustomerCreateNestedOneWithoutPaymentsInput
  }

  export type PaymentUncheckedCreateWithoutOrderInput = {
    id?: number
    customerId?: number | null
    amount: number
    paymentDate?: Date | string
    paymentMethod?: string | null
    notes?: string | null
    isDeleted?: boolean
  }

  export type PaymentCreateOrConnectWithoutOrderInput = {
    where: PaymentWhereUniqueInput
    create: XOR<PaymentCreateWithoutOrderInput, PaymentUncheckedCreateWithoutOrderInput>
  }

  export type PaymentCreateManyOrderInputEnvelope = {
    data: PaymentCreateManyOrderInput | PaymentCreateManyOrderInput[]
  }

  export type PaymentObligationCreateWithoutOrderInput = {
    productId?: number | null
    amount: number
    quantity?: number
    description?: string | null
    createdAt?: Date | string
    isDeleted?: boolean
    isRefund?: boolean
    isManual?: boolean
  }

  export type PaymentObligationUncheckedCreateWithoutOrderInput = {
    id?: number
    productId?: number | null
    amount: number
    quantity?: number
    description?: string | null
    createdAt?: Date | string
    isDeleted?: boolean
    isRefund?: boolean
    isManual?: boolean
  }

  export type PaymentObligationCreateOrConnectWithoutOrderInput = {
    where: PaymentObligationWhereUniqueInput
    create: XOR<PaymentObligationCreateWithoutOrderInput, PaymentObligationUncheckedCreateWithoutOrderInput>
  }

  export type PaymentObligationCreateManyOrderInputEnvelope = {
    data: PaymentObligationCreateManyOrderInput | PaymentObligationCreateManyOrderInput[]
  }

  export type CustomerUpsertWithoutOrdersInput = {
    update: XOR<CustomerUpdateWithoutOrdersInput, CustomerUncheckedUpdateWithoutOrdersInput>
    create: XOR<CustomerCreateWithoutOrdersInput, CustomerUncheckedCreateWithoutOrdersInput>
    where?: CustomerWhereInput
  }

  export type CustomerUpdateToOneWithWhereWithoutOrdersInput = {
    where?: CustomerWhereInput
    data: XOR<CustomerUpdateWithoutOrdersInput, CustomerUncheckedUpdateWithoutOrdersInput>
  }

  export type CustomerUpdateWithoutOrdersInput = {
    firstName?: NullableStringFieldUpdateOperationsInput | string | null
    lastName?: NullableStringFieldUpdateOperationsInput | string | null
    phone1?: NullableStringFieldUpdateOperationsInput | string | null
    phone2?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    street?: NullableStringFieldUpdateOperationsInput | string | null
    houseNum?: NullableIntFieldUpdateOperationsInput | number | null
    email?: NullableStringFieldUpdateOperationsInput | string | null
    emailSuffix?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    registrationDate?: NullableStringFieldUpdateOperationsInput | string | null
    officeNotes?: NullableStringFieldUpdateOperationsInput | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    payments?: PaymentUpdateManyWithoutCustomerNestedInput
  }

  export type CustomerUncheckedUpdateWithoutOrdersInput = {
    id?: IntFieldUpdateOperationsInput | number
    firstName?: NullableStringFieldUpdateOperationsInput | string | null
    lastName?: NullableStringFieldUpdateOperationsInput | string | null
    phone1?: NullableStringFieldUpdateOperationsInput | string | null
    phone2?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    street?: NullableStringFieldUpdateOperationsInput | string | null
    houseNum?: NullableIntFieldUpdateOperationsInput | number | null
    email?: NullableStringFieldUpdateOperationsInput | string | null
    emailSuffix?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    registrationDate?: NullableStringFieldUpdateOperationsInput | string | null
    officeNotes?: NullableStringFieldUpdateOperationsInput | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    payments?: PaymentUncheckedUpdateManyWithoutCustomerNestedInput
  }

  export type OrderItemUpsertWithWhereUniqueWithoutOrderInput = {
    where: OrderItemWhereUniqueInput
    update: XOR<OrderItemUpdateWithoutOrderInput, OrderItemUncheckedUpdateWithoutOrderInput>
    create: XOR<OrderItemCreateWithoutOrderInput, OrderItemUncheckedCreateWithoutOrderInput>
  }

  export type OrderItemUpdateWithWhereUniqueWithoutOrderInput = {
    where: OrderItemWhereUniqueInput
    data: XOR<OrderItemUpdateWithoutOrderInput, OrderItemUncheckedUpdateWithoutOrderInput>
  }

  export type OrderItemUpdateManyWithWhereWithoutOrderInput = {
    where: OrderItemScalarWhereInput
    data: XOR<OrderItemUpdateManyMutationInput, OrderItemUncheckedUpdateManyWithoutOrderInput>
  }

  export type PaymentUpsertWithWhereUniqueWithoutOrderInput = {
    where: PaymentWhereUniqueInput
    update: XOR<PaymentUpdateWithoutOrderInput, PaymentUncheckedUpdateWithoutOrderInput>
    create: XOR<PaymentCreateWithoutOrderInput, PaymentUncheckedCreateWithoutOrderInput>
  }

  export type PaymentUpdateWithWhereUniqueWithoutOrderInput = {
    where: PaymentWhereUniqueInput
    data: XOR<PaymentUpdateWithoutOrderInput, PaymentUncheckedUpdateWithoutOrderInput>
  }

  export type PaymentUpdateManyWithWhereWithoutOrderInput = {
    where: PaymentScalarWhereInput
    data: XOR<PaymentUpdateManyMutationInput, PaymentUncheckedUpdateManyWithoutOrderInput>
  }

  export type PaymentObligationUpsertWithWhereUniqueWithoutOrderInput = {
    where: PaymentObligationWhereUniqueInput
    update: XOR<PaymentObligationUpdateWithoutOrderInput, PaymentObligationUncheckedUpdateWithoutOrderInput>
    create: XOR<PaymentObligationCreateWithoutOrderInput, PaymentObligationUncheckedCreateWithoutOrderInput>
  }

  export type PaymentObligationUpdateWithWhereUniqueWithoutOrderInput = {
    where: PaymentObligationWhereUniqueInput
    data: XOR<PaymentObligationUpdateWithoutOrderInput, PaymentObligationUncheckedUpdateWithoutOrderInput>
  }

  export type PaymentObligationUpdateManyWithWhereWithoutOrderInput = {
    where: PaymentObligationScalarWhereInput
    data: XOR<PaymentObligationUpdateManyMutationInput, PaymentObligationUncheckedUpdateManyWithoutOrderInput>
  }

  export type PaymentObligationScalarWhereInput = {
    AND?: PaymentObligationScalarWhereInput | PaymentObligationScalarWhereInput[]
    OR?: PaymentObligationScalarWhereInput[]
    NOT?: PaymentObligationScalarWhereInput | PaymentObligationScalarWhereInput[]
    id?: IntFilter<"PaymentObligation"> | number
    orderId?: IntFilter<"PaymentObligation"> | number
    productId?: IntNullableFilter<"PaymentObligation"> | number | null
    amount?: FloatFilter<"PaymentObligation"> | number
    quantity?: IntFilter<"PaymentObligation"> | number
    description?: StringNullableFilter<"PaymentObligation"> | string | null
    createdAt?: DateTimeFilter<"PaymentObligation"> | Date | string
    isDeleted?: BoolFilter<"PaymentObligation"> | boolean
    isRefund?: BoolFilter<"PaymentObligation"> | boolean
    isManual?: BoolFilter<"PaymentObligation"> | boolean
  }

  export type CustomerCreateWithoutPaymentsInput = {
    firstName?: string | null
    lastName?: string | null
    phone1?: string | null
    phone2?: string | null
    city?: string | null
    street?: string | null
    houseNum?: number | null
    email?: string | null
    emailSuffix?: string | null
    notes?: string | null
    registrationDate?: string | null
    officeNotes?: string | null
    isDeleted?: boolean
    orders?: OrderCreateNestedManyWithoutCustomerInput
  }

  export type CustomerUncheckedCreateWithoutPaymentsInput = {
    id?: number
    firstName?: string | null
    lastName?: string | null
    phone1?: string | null
    phone2?: string | null
    city?: string | null
    street?: string | null
    houseNum?: number | null
    email?: string | null
    emailSuffix?: string | null
    notes?: string | null
    registrationDate?: string | null
    officeNotes?: string | null
    isDeleted?: boolean
    orders?: OrderUncheckedCreateNestedManyWithoutCustomerInput
  }

  export type CustomerCreateOrConnectWithoutPaymentsInput = {
    where: CustomerWhereUniqueInput
    create: XOR<CustomerCreateWithoutPaymentsInput, CustomerUncheckedCreateWithoutPaymentsInput>
  }

  export type OrderCreateWithoutPaymentsInput = {
    orderId: number
    totalAmount?: number | null
    paymentDate?: Date | string | null
    paymentMethod?: string | null
    status?: string | null
    notes?: string | null
    isPaid?: boolean
    isDeleted?: boolean
    orderNotes?: string | null
    eventDate?: Date | string | null
    eventDateHebrew?: string | null
    returnDate?: Date | string | null
    isWeekdayEvent?: boolean
    orderDate?: Date | string | null
    isAbroad?: boolean
    fromDate?: Date | string | null
    toDate?: Date | string | null
    customer?: CustomerCreateNestedOneWithoutOrdersInput
    items?: OrderItemCreateNestedManyWithoutOrderInput
    obligations?: PaymentObligationCreateNestedManyWithoutOrderInput
  }

  export type OrderUncheckedCreateWithoutPaymentsInput = {
    id?: number
    orderId: number
    customerId?: number | null
    totalAmount?: number | null
    paymentDate?: Date | string | null
    paymentMethod?: string | null
    status?: string | null
    notes?: string | null
    isPaid?: boolean
    isDeleted?: boolean
    orderNotes?: string | null
    eventDate?: Date | string | null
    eventDateHebrew?: string | null
    returnDate?: Date | string | null
    isWeekdayEvent?: boolean
    orderDate?: Date | string | null
    isAbroad?: boolean
    fromDate?: Date | string | null
    toDate?: Date | string | null
    items?: OrderItemUncheckedCreateNestedManyWithoutOrderInput
    obligations?: PaymentObligationUncheckedCreateNestedManyWithoutOrderInput
  }

  export type OrderCreateOrConnectWithoutPaymentsInput = {
    where: OrderWhereUniqueInput
    create: XOR<OrderCreateWithoutPaymentsInput, OrderUncheckedCreateWithoutPaymentsInput>
  }

  export type CustomerUpsertWithoutPaymentsInput = {
    update: XOR<CustomerUpdateWithoutPaymentsInput, CustomerUncheckedUpdateWithoutPaymentsInput>
    create: XOR<CustomerCreateWithoutPaymentsInput, CustomerUncheckedCreateWithoutPaymentsInput>
    where?: CustomerWhereInput
  }

  export type CustomerUpdateToOneWithWhereWithoutPaymentsInput = {
    where?: CustomerWhereInput
    data: XOR<CustomerUpdateWithoutPaymentsInput, CustomerUncheckedUpdateWithoutPaymentsInput>
  }

  export type CustomerUpdateWithoutPaymentsInput = {
    firstName?: NullableStringFieldUpdateOperationsInput | string | null
    lastName?: NullableStringFieldUpdateOperationsInput | string | null
    phone1?: NullableStringFieldUpdateOperationsInput | string | null
    phone2?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    street?: NullableStringFieldUpdateOperationsInput | string | null
    houseNum?: NullableIntFieldUpdateOperationsInput | number | null
    email?: NullableStringFieldUpdateOperationsInput | string | null
    emailSuffix?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    registrationDate?: NullableStringFieldUpdateOperationsInput | string | null
    officeNotes?: NullableStringFieldUpdateOperationsInput | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    orders?: OrderUpdateManyWithoutCustomerNestedInput
  }

  export type CustomerUncheckedUpdateWithoutPaymentsInput = {
    id?: IntFieldUpdateOperationsInput | number
    firstName?: NullableStringFieldUpdateOperationsInput | string | null
    lastName?: NullableStringFieldUpdateOperationsInput | string | null
    phone1?: NullableStringFieldUpdateOperationsInput | string | null
    phone2?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    street?: NullableStringFieldUpdateOperationsInput | string | null
    houseNum?: NullableIntFieldUpdateOperationsInput | number | null
    email?: NullableStringFieldUpdateOperationsInput | string | null
    emailSuffix?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    registrationDate?: NullableStringFieldUpdateOperationsInput | string | null
    officeNotes?: NullableStringFieldUpdateOperationsInput | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    orders?: OrderUncheckedUpdateManyWithoutCustomerNestedInput
  }

  export type OrderUpsertWithoutPaymentsInput = {
    update: XOR<OrderUpdateWithoutPaymentsInput, OrderUncheckedUpdateWithoutPaymentsInput>
    create: XOR<OrderCreateWithoutPaymentsInput, OrderUncheckedCreateWithoutPaymentsInput>
    where?: OrderWhereInput
  }

  export type OrderUpdateToOneWithWhereWithoutPaymentsInput = {
    where?: OrderWhereInput
    data: XOR<OrderUpdateWithoutPaymentsInput, OrderUncheckedUpdateWithoutPaymentsInput>
  }

  export type OrderUpdateWithoutPaymentsInput = {
    orderId?: IntFieldUpdateOperationsInput | number
    totalAmount?: NullableFloatFieldUpdateOperationsInput | number | null
    paymentDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    paymentMethod?: NullableStringFieldUpdateOperationsInput | string | null
    status?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    isPaid?: BoolFieldUpdateOperationsInput | boolean
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    orderNotes?: NullableStringFieldUpdateOperationsInput | string | null
    eventDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    eventDateHebrew?: NullableStringFieldUpdateOperationsInput | string | null
    returnDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isWeekdayEvent?: BoolFieldUpdateOperationsInput | boolean
    orderDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isAbroad?: BoolFieldUpdateOperationsInput | boolean
    fromDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    toDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    customer?: CustomerUpdateOneWithoutOrdersNestedInput
    items?: OrderItemUpdateManyWithoutOrderNestedInput
    obligations?: PaymentObligationUpdateManyWithoutOrderNestedInput
  }

  export type OrderUncheckedUpdateWithoutPaymentsInput = {
    id?: IntFieldUpdateOperationsInput | number
    orderId?: IntFieldUpdateOperationsInput | number
    customerId?: NullableIntFieldUpdateOperationsInput | number | null
    totalAmount?: NullableFloatFieldUpdateOperationsInput | number | null
    paymentDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    paymentMethod?: NullableStringFieldUpdateOperationsInput | string | null
    status?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    isPaid?: BoolFieldUpdateOperationsInput | boolean
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    orderNotes?: NullableStringFieldUpdateOperationsInput | string | null
    eventDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    eventDateHebrew?: NullableStringFieldUpdateOperationsInput | string | null
    returnDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isWeekdayEvent?: BoolFieldUpdateOperationsInput | boolean
    orderDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isAbroad?: BoolFieldUpdateOperationsInput | boolean
    fromDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    toDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    items?: OrderItemUncheckedUpdateManyWithoutOrderNestedInput
    obligations?: PaymentObligationUncheckedUpdateManyWithoutOrderNestedInput
  }

  export type OrderCreateWithoutObligationsInput = {
    orderId: number
    totalAmount?: number | null
    paymentDate?: Date | string | null
    paymentMethod?: string | null
    status?: string | null
    notes?: string | null
    isPaid?: boolean
    isDeleted?: boolean
    orderNotes?: string | null
    eventDate?: Date | string | null
    eventDateHebrew?: string | null
    returnDate?: Date | string | null
    isWeekdayEvent?: boolean
    orderDate?: Date | string | null
    isAbroad?: boolean
    fromDate?: Date | string | null
    toDate?: Date | string | null
    customer?: CustomerCreateNestedOneWithoutOrdersInput
    items?: OrderItemCreateNestedManyWithoutOrderInput
    payments?: PaymentCreateNestedManyWithoutOrderInput
  }

  export type OrderUncheckedCreateWithoutObligationsInput = {
    id?: number
    orderId: number
    customerId?: number | null
    totalAmount?: number | null
    paymentDate?: Date | string | null
    paymentMethod?: string | null
    status?: string | null
    notes?: string | null
    isPaid?: boolean
    isDeleted?: boolean
    orderNotes?: string | null
    eventDate?: Date | string | null
    eventDateHebrew?: string | null
    returnDate?: Date | string | null
    isWeekdayEvent?: boolean
    orderDate?: Date | string | null
    isAbroad?: boolean
    fromDate?: Date | string | null
    toDate?: Date | string | null
    items?: OrderItemUncheckedCreateNestedManyWithoutOrderInput
    payments?: PaymentUncheckedCreateNestedManyWithoutOrderInput
  }

  export type OrderCreateOrConnectWithoutObligationsInput = {
    where: OrderWhereUniqueInput
    create: XOR<OrderCreateWithoutObligationsInput, OrderUncheckedCreateWithoutObligationsInput>
  }

  export type OrderUpsertWithoutObligationsInput = {
    update: XOR<OrderUpdateWithoutObligationsInput, OrderUncheckedUpdateWithoutObligationsInput>
    create: XOR<OrderCreateWithoutObligationsInput, OrderUncheckedCreateWithoutObligationsInput>
    where?: OrderWhereInput
  }

  export type OrderUpdateToOneWithWhereWithoutObligationsInput = {
    where?: OrderWhereInput
    data: XOR<OrderUpdateWithoutObligationsInput, OrderUncheckedUpdateWithoutObligationsInput>
  }

  export type OrderUpdateWithoutObligationsInput = {
    orderId?: IntFieldUpdateOperationsInput | number
    totalAmount?: NullableFloatFieldUpdateOperationsInput | number | null
    paymentDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    paymentMethod?: NullableStringFieldUpdateOperationsInput | string | null
    status?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    isPaid?: BoolFieldUpdateOperationsInput | boolean
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    orderNotes?: NullableStringFieldUpdateOperationsInput | string | null
    eventDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    eventDateHebrew?: NullableStringFieldUpdateOperationsInput | string | null
    returnDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isWeekdayEvent?: BoolFieldUpdateOperationsInput | boolean
    orderDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isAbroad?: BoolFieldUpdateOperationsInput | boolean
    fromDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    toDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    customer?: CustomerUpdateOneWithoutOrdersNestedInput
    items?: OrderItemUpdateManyWithoutOrderNestedInput
    payments?: PaymentUpdateManyWithoutOrderNestedInput
  }

  export type OrderUncheckedUpdateWithoutObligationsInput = {
    id?: IntFieldUpdateOperationsInput | number
    orderId?: IntFieldUpdateOperationsInput | number
    customerId?: NullableIntFieldUpdateOperationsInput | number | null
    totalAmount?: NullableFloatFieldUpdateOperationsInput | number | null
    paymentDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    paymentMethod?: NullableStringFieldUpdateOperationsInput | string | null
    status?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    isPaid?: BoolFieldUpdateOperationsInput | boolean
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    orderNotes?: NullableStringFieldUpdateOperationsInput | string | null
    eventDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    eventDateHebrew?: NullableStringFieldUpdateOperationsInput | string | null
    returnDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isWeekdayEvent?: BoolFieldUpdateOperationsInput | boolean
    orderDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isAbroad?: BoolFieldUpdateOperationsInput | boolean
    fromDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    toDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    items?: OrderItemUncheckedUpdateManyWithoutOrderNestedInput
    payments?: PaymentUncheckedUpdateManyWithoutOrderNestedInput
  }

  export type OrderCreateWithoutItemsInput = {
    orderId: number
    totalAmount?: number | null
    paymentDate?: Date | string | null
    paymentMethod?: string | null
    status?: string | null
    notes?: string | null
    isPaid?: boolean
    isDeleted?: boolean
    orderNotes?: string | null
    eventDate?: Date | string | null
    eventDateHebrew?: string | null
    returnDate?: Date | string | null
    isWeekdayEvent?: boolean
    orderDate?: Date | string | null
    isAbroad?: boolean
    fromDate?: Date | string | null
    toDate?: Date | string | null
    customer?: CustomerCreateNestedOneWithoutOrdersInput
    payments?: PaymentCreateNestedManyWithoutOrderInput
    obligations?: PaymentObligationCreateNestedManyWithoutOrderInput
  }

  export type OrderUncheckedCreateWithoutItemsInput = {
    id?: number
    orderId: number
    customerId?: number | null
    totalAmount?: number | null
    paymentDate?: Date | string | null
    paymentMethod?: string | null
    status?: string | null
    notes?: string | null
    isPaid?: boolean
    isDeleted?: boolean
    orderNotes?: string | null
    eventDate?: Date | string | null
    eventDateHebrew?: string | null
    returnDate?: Date | string | null
    isWeekdayEvent?: boolean
    orderDate?: Date | string | null
    isAbroad?: boolean
    fromDate?: Date | string | null
    toDate?: Date | string | null
    payments?: PaymentUncheckedCreateNestedManyWithoutOrderInput
    obligations?: PaymentObligationUncheckedCreateNestedManyWithoutOrderInput
  }

  export type OrderCreateOrConnectWithoutItemsInput = {
    where: OrderWhereUniqueInput
    create: XOR<OrderCreateWithoutItemsInput, OrderUncheckedCreateWithoutItemsInput>
  }

  export type DressItemCreateWithoutOrderItemsInput = {
    barcodePrefix?: number | null
    dressName?: string | null
    sizeText?: string | null
    serialNumber?: number | null
    dressBarcode?: string | null
    location?: string | null
    locationNum?: number | null
    quantity?: number | null
    inRepair?: boolean
    notInUse?: boolean
    notInUseSince?: Date | string | null
    entryDateToRepo?: Date | string | null
    isDeleted?: boolean
    deletedAt?: Date | string | null
    dress?: DressModelCreateNestedOneWithoutItemsInput
  }

  export type DressItemUncheckedCreateWithoutOrderItemsInput = {
    id?: number
    barcodePrefix?: number | null
    dressModelId?: number | null
    dressName?: string | null
    sizeText?: string | null
    serialNumber?: number | null
    dressBarcode?: string | null
    location?: string | null
    locationNum?: number | null
    quantity?: number | null
    inRepair?: boolean
    notInUse?: boolean
    notInUseSince?: Date | string | null
    entryDateToRepo?: Date | string | null
    isDeleted?: boolean
    deletedAt?: Date | string | null
  }

  export type DressItemCreateOrConnectWithoutOrderItemsInput = {
    where: DressItemWhereUniqueInput
    create: XOR<DressItemCreateWithoutOrderItemsInput, DressItemUncheckedCreateWithoutOrderItemsInput>
  }

  export type OrderUpsertWithoutItemsInput = {
    update: XOR<OrderUpdateWithoutItemsInput, OrderUncheckedUpdateWithoutItemsInput>
    create: XOR<OrderCreateWithoutItemsInput, OrderUncheckedCreateWithoutItemsInput>
    where?: OrderWhereInput
  }

  export type OrderUpdateToOneWithWhereWithoutItemsInput = {
    where?: OrderWhereInput
    data: XOR<OrderUpdateWithoutItemsInput, OrderUncheckedUpdateWithoutItemsInput>
  }

  export type OrderUpdateWithoutItemsInput = {
    orderId?: IntFieldUpdateOperationsInput | number
    totalAmount?: NullableFloatFieldUpdateOperationsInput | number | null
    paymentDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    paymentMethod?: NullableStringFieldUpdateOperationsInput | string | null
    status?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    isPaid?: BoolFieldUpdateOperationsInput | boolean
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    orderNotes?: NullableStringFieldUpdateOperationsInput | string | null
    eventDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    eventDateHebrew?: NullableStringFieldUpdateOperationsInput | string | null
    returnDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isWeekdayEvent?: BoolFieldUpdateOperationsInput | boolean
    orderDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isAbroad?: BoolFieldUpdateOperationsInput | boolean
    fromDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    toDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    customer?: CustomerUpdateOneWithoutOrdersNestedInput
    payments?: PaymentUpdateManyWithoutOrderNestedInput
    obligations?: PaymentObligationUpdateManyWithoutOrderNestedInput
  }

  export type OrderUncheckedUpdateWithoutItemsInput = {
    id?: IntFieldUpdateOperationsInput | number
    orderId?: IntFieldUpdateOperationsInput | number
    customerId?: NullableIntFieldUpdateOperationsInput | number | null
    totalAmount?: NullableFloatFieldUpdateOperationsInput | number | null
    paymentDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    paymentMethod?: NullableStringFieldUpdateOperationsInput | string | null
    status?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    isPaid?: BoolFieldUpdateOperationsInput | boolean
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    orderNotes?: NullableStringFieldUpdateOperationsInput | string | null
    eventDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    eventDateHebrew?: NullableStringFieldUpdateOperationsInput | string | null
    returnDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isWeekdayEvent?: BoolFieldUpdateOperationsInput | boolean
    orderDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isAbroad?: BoolFieldUpdateOperationsInput | boolean
    fromDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    toDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    payments?: PaymentUncheckedUpdateManyWithoutOrderNestedInput
    obligations?: PaymentObligationUncheckedUpdateManyWithoutOrderNestedInput
  }

  export type DressItemUpsertWithoutOrderItemsInput = {
    update: XOR<DressItemUpdateWithoutOrderItemsInput, DressItemUncheckedUpdateWithoutOrderItemsInput>
    create: XOR<DressItemCreateWithoutOrderItemsInput, DressItemUncheckedCreateWithoutOrderItemsInput>
    where?: DressItemWhereInput
  }

  export type DressItemUpdateToOneWithWhereWithoutOrderItemsInput = {
    where?: DressItemWhereInput
    data: XOR<DressItemUpdateWithoutOrderItemsInput, DressItemUncheckedUpdateWithoutOrderItemsInput>
  }

  export type DressItemUpdateWithoutOrderItemsInput = {
    barcodePrefix?: NullableIntFieldUpdateOperationsInput | number | null
    dressName?: NullableStringFieldUpdateOperationsInput | string | null
    sizeText?: NullableStringFieldUpdateOperationsInput | string | null
    serialNumber?: NullableIntFieldUpdateOperationsInput | number | null
    dressBarcode?: NullableStringFieldUpdateOperationsInput | string | null
    location?: NullableStringFieldUpdateOperationsInput | string | null
    locationNum?: NullableIntFieldUpdateOperationsInput | number | null
    quantity?: NullableIntFieldUpdateOperationsInput | number | null
    inRepair?: BoolFieldUpdateOperationsInput | boolean
    notInUse?: BoolFieldUpdateOperationsInput | boolean
    notInUseSince?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    entryDateToRepo?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    dress?: DressModelUpdateOneWithoutItemsNestedInput
  }

  export type DressItemUncheckedUpdateWithoutOrderItemsInput = {
    id?: IntFieldUpdateOperationsInput | number
    barcodePrefix?: NullableIntFieldUpdateOperationsInput | number | null
    dressModelId?: NullableIntFieldUpdateOperationsInput | number | null
    dressName?: NullableStringFieldUpdateOperationsInput | string | null
    sizeText?: NullableStringFieldUpdateOperationsInput | string | null
    serialNumber?: NullableIntFieldUpdateOperationsInput | number | null
    dressBarcode?: NullableStringFieldUpdateOperationsInput | string | null
    location?: NullableStringFieldUpdateOperationsInput | string | null
    locationNum?: NullableIntFieldUpdateOperationsInput | number | null
    quantity?: NullableIntFieldUpdateOperationsInput | number | null
    inRepair?: BoolFieldUpdateOperationsInput | boolean
    notInUse?: BoolFieldUpdateOperationsInput | boolean
    notInUseSince?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    entryDateToRepo?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type EmployeeCreateWithoutPageVisitsInput = {
    firstName?: string | null
    lastName?: string | null
    phone1?: string | null
    phone2?: string | null
    city?: string | null
    street?: string | null
    houseNum?: string | null
    email?: string | null
    joinDate?: Date | string | null
    fullName?: string | null
    notes?: string | null
    emailSuffix?: string | null
    roleId?: number | null
    password?: string | null
    isActive?: boolean
    hourlyWage?: number | null
    paymentMethod?: string | null
    travelExpenses?: boolean | null
    shifts?: ShiftCreateNestedManyWithoutEmployeeInput
  }

  export type EmployeeUncheckedCreateWithoutPageVisitsInput = {
    id?: number
    firstName?: string | null
    lastName?: string | null
    phone1?: string | null
    phone2?: string | null
    city?: string | null
    street?: string | null
    houseNum?: string | null
    email?: string | null
    joinDate?: Date | string | null
    fullName?: string | null
    notes?: string | null
    emailSuffix?: string | null
    roleId?: number | null
    password?: string | null
    isActive?: boolean
    hourlyWage?: number | null
    paymentMethod?: string | null
    travelExpenses?: boolean | null
    shifts?: ShiftUncheckedCreateNestedManyWithoutEmployeeInput
  }

  export type EmployeeCreateOrConnectWithoutPageVisitsInput = {
    where: EmployeeWhereUniqueInput
    create: XOR<EmployeeCreateWithoutPageVisitsInput, EmployeeUncheckedCreateWithoutPageVisitsInput>
  }

  export type EmployeeUpsertWithoutPageVisitsInput = {
    update: XOR<EmployeeUpdateWithoutPageVisitsInput, EmployeeUncheckedUpdateWithoutPageVisitsInput>
    create: XOR<EmployeeCreateWithoutPageVisitsInput, EmployeeUncheckedCreateWithoutPageVisitsInput>
    where?: EmployeeWhereInput
  }

  export type EmployeeUpdateToOneWithWhereWithoutPageVisitsInput = {
    where?: EmployeeWhereInput
    data: XOR<EmployeeUpdateWithoutPageVisitsInput, EmployeeUncheckedUpdateWithoutPageVisitsInput>
  }

  export type EmployeeUpdateWithoutPageVisitsInput = {
    firstName?: NullableStringFieldUpdateOperationsInput | string | null
    lastName?: NullableStringFieldUpdateOperationsInput | string | null
    phone1?: NullableStringFieldUpdateOperationsInput | string | null
    phone2?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    street?: NullableStringFieldUpdateOperationsInput | string | null
    houseNum?: NullableStringFieldUpdateOperationsInput | string | null
    email?: NullableStringFieldUpdateOperationsInput | string | null
    joinDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    fullName?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    emailSuffix?: NullableStringFieldUpdateOperationsInput | string | null
    roleId?: NullableIntFieldUpdateOperationsInput | number | null
    password?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    hourlyWage?: NullableFloatFieldUpdateOperationsInput | number | null
    paymentMethod?: NullableStringFieldUpdateOperationsInput | string | null
    travelExpenses?: NullableBoolFieldUpdateOperationsInput | boolean | null
    shifts?: ShiftUpdateManyWithoutEmployeeNestedInput
  }

  export type EmployeeUncheckedUpdateWithoutPageVisitsInput = {
    id?: IntFieldUpdateOperationsInput | number
    firstName?: NullableStringFieldUpdateOperationsInput | string | null
    lastName?: NullableStringFieldUpdateOperationsInput | string | null
    phone1?: NullableStringFieldUpdateOperationsInput | string | null
    phone2?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    street?: NullableStringFieldUpdateOperationsInput | string | null
    houseNum?: NullableStringFieldUpdateOperationsInput | string | null
    email?: NullableStringFieldUpdateOperationsInput | string | null
    joinDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    fullName?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    emailSuffix?: NullableStringFieldUpdateOperationsInput | string | null
    roleId?: NullableIntFieldUpdateOperationsInput | number | null
    password?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    hourlyWage?: NullableFloatFieldUpdateOperationsInput | number | null
    paymentMethod?: NullableStringFieldUpdateOperationsInput | string | null
    travelExpenses?: NullableBoolFieldUpdateOperationsInput | boolean | null
    shifts?: ShiftUncheckedUpdateManyWithoutEmployeeNestedInput
  }

  export type OrderCreateManyCustomerInput = {
    id?: number
    orderId: number
    totalAmount?: number | null
    paymentDate?: Date | string | null
    paymentMethod?: string | null
    status?: string | null
    notes?: string | null
    isPaid?: boolean
    isDeleted?: boolean
    orderNotes?: string | null
    eventDate?: Date | string | null
    eventDateHebrew?: string | null
    returnDate?: Date | string | null
    isWeekdayEvent?: boolean
    orderDate?: Date | string | null
    isAbroad?: boolean
    fromDate?: Date | string | null
    toDate?: Date | string | null
  }

  export type PaymentCreateManyCustomerInput = {
    id?: number
    orderId?: number | null
    amount: number
    paymentDate?: Date | string
    paymentMethod?: string | null
    notes?: string | null
    isDeleted?: boolean
  }

  export type OrderUpdateWithoutCustomerInput = {
    orderId?: IntFieldUpdateOperationsInput | number
    totalAmount?: NullableFloatFieldUpdateOperationsInput | number | null
    paymentDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    paymentMethod?: NullableStringFieldUpdateOperationsInput | string | null
    status?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    isPaid?: BoolFieldUpdateOperationsInput | boolean
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    orderNotes?: NullableStringFieldUpdateOperationsInput | string | null
    eventDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    eventDateHebrew?: NullableStringFieldUpdateOperationsInput | string | null
    returnDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isWeekdayEvent?: BoolFieldUpdateOperationsInput | boolean
    orderDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isAbroad?: BoolFieldUpdateOperationsInput | boolean
    fromDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    toDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    items?: OrderItemUpdateManyWithoutOrderNestedInput
    payments?: PaymentUpdateManyWithoutOrderNestedInput
    obligations?: PaymentObligationUpdateManyWithoutOrderNestedInput
  }

  export type OrderUncheckedUpdateWithoutCustomerInput = {
    id?: IntFieldUpdateOperationsInput | number
    orderId?: IntFieldUpdateOperationsInput | number
    totalAmount?: NullableFloatFieldUpdateOperationsInput | number | null
    paymentDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    paymentMethod?: NullableStringFieldUpdateOperationsInput | string | null
    status?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    isPaid?: BoolFieldUpdateOperationsInput | boolean
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    orderNotes?: NullableStringFieldUpdateOperationsInput | string | null
    eventDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    eventDateHebrew?: NullableStringFieldUpdateOperationsInput | string | null
    returnDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isWeekdayEvent?: BoolFieldUpdateOperationsInput | boolean
    orderDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isAbroad?: BoolFieldUpdateOperationsInput | boolean
    fromDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    toDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    items?: OrderItemUncheckedUpdateManyWithoutOrderNestedInput
    payments?: PaymentUncheckedUpdateManyWithoutOrderNestedInput
    obligations?: PaymentObligationUncheckedUpdateManyWithoutOrderNestedInput
  }

  export type OrderUncheckedUpdateManyWithoutCustomerInput = {
    id?: IntFieldUpdateOperationsInput | number
    orderId?: IntFieldUpdateOperationsInput | number
    totalAmount?: NullableFloatFieldUpdateOperationsInput | number | null
    paymentDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    paymentMethod?: NullableStringFieldUpdateOperationsInput | string | null
    status?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    isPaid?: BoolFieldUpdateOperationsInput | boolean
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    orderNotes?: NullableStringFieldUpdateOperationsInput | string | null
    eventDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    eventDateHebrew?: NullableStringFieldUpdateOperationsInput | string | null
    returnDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isWeekdayEvent?: BoolFieldUpdateOperationsInput | boolean
    orderDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isAbroad?: BoolFieldUpdateOperationsInput | boolean
    fromDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    toDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type PaymentUpdateWithoutCustomerInput = {
    amount?: FloatFieldUpdateOperationsInput | number
    paymentDate?: DateTimeFieldUpdateOperationsInput | Date | string
    paymentMethod?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    order?: OrderUpdateOneWithoutPaymentsNestedInput
  }

  export type PaymentUncheckedUpdateWithoutCustomerInput = {
    id?: IntFieldUpdateOperationsInput | number
    orderId?: NullableIntFieldUpdateOperationsInput | number | null
    amount?: FloatFieldUpdateOperationsInput | number
    paymentDate?: DateTimeFieldUpdateOperationsInput | Date | string
    paymentMethod?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
  }

  export type PaymentUncheckedUpdateManyWithoutCustomerInput = {
    id?: IntFieldUpdateOperationsInput | number
    orderId?: NullableIntFieldUpdateOperationsInput | number | null
    amount?: FloatFieldUpdateOperationsInput | number
    paymentDate?: DateTimeFieldUpdateOperationsInput | Date | string
    paymentMethod?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
  }

  export type PageVisitLogCreateManyEmployeeInput = {
    id?: number
    pageUrl: string
    employeeName?: string | null
    timestamp?: Date | string
    loadingError?: string | null
    isGuest?: boolean
  }

  export type ShiftCreateManyEmployeeInput = {
    id?: number
    entryTime?: Date | string | null
    exitTime?: Date | string | null
    hebrewDate?: string | null
    date?: Date | string | null
    totalMinutes?: number | null
    hourlyWageSnapshot?: number | null
    travelExpensesSnapshot?: number | null
    totalCalculated?: number | null
    paymentMethod?: string | null
    notes?: string | null
    isDeleted?: boolean
  }

  export type PageVisitLogUpdateWithoutEmployeeInput = {
    pageUrl?: StringFieldUpdateOperationsInput | string
    employeeName?: NullableStringFieldUpdateOperationsInput | string | null
    timestamp?: DateTimeFieldUpdateOperationsInput | Date | string
    loadingError?: NullableStringFieldUpdateOperationsInput | string | null
    isGuest?: BoolFieldUpdateOperationsInput | boolean
  }

  export type PageVisitLogUncheckedUpdateWithoutEmployeeInput = {
    id?: IntFieldUpdateOperationsInput | number
    pageUrl?: StringFieldUpdateOperationsInput | string
    employeeName?: NullableStringFieldUpdateOperationsInput | string | null
    timestamp?: DateTimeFieldUpdateOperationsInput | Date | string
    loadingError?: NullableStringFieldUpdateOperationsInput | string | null
    isGuest?: BoolFieldUpdateOperationsInput | boolean
  }

  export type PageVisitLogUncheckedUpdateManyWithoutEmployeeInput = {
    id?: IntFieldUpdateOperationsInput | number
    pageUrl?: StringFieldUpdateOperationsInput | string
    employeeName?: NullableStringFieldUpdateOperationsInput | string | null
    timestamp?: DateTimeFieldUpdateOperationsInput | Date | string
    loadingError?: NullableStringFieldUpdateOperationsInput | string | null
    isGuest?: BoolFieldUpdateOperationsInput | boolean
  }

  export type ShiftUpdateWithoutEmployeeInput = {
    entryTime?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    exitTime?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    hebrewDate?: NullableStringFieldUpdateOperationsInput | string | null
    date?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    totalMinutes?: NullableIntFieldUpdateOperationsInput | number | null
    hourlyWageSnapshot?: NullableFloatFieldUpdateOperationsInput | number | null
    travelExpensesSnapshot?: NullableFloatFieldUpdateOperationsInput | number | null
    totalCalculated?: NullableFloatFieldUpdateOperationsInput | number | null
    paymentMethod?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
  }

  export type ShiftUncheckedUpdateWithoutEmployeeInput = {
    id?: IntFieldUpdateOperationsInput | number
    entryTime?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    exitTime?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    hebrewDate?: NullableStringFieldUpdateOperationsInput | string | null
    date?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    totalMinutes?: NullableIntFieldUpdateOperationsInput | number | null
    hourlyWageSnapshot?: NullableFloatFieldUpdateOperationsInput | number | null
    travelExpensesSnapshot?: NullableFloatFieldUpdateOperationsInput | number | null
    totalCalculated?: NullableFloatFieldUpdateOperationsInput | number | null
    paymentMethod?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
  }

  export type ShiftUncheckedUpdateManyWithoutEmployeeInput = {
    id?: IntFieldUpdateOperationsInput | number
    entryTime?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    exitTime?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    hebrewDate?: NullableStringFieldUpdateOperationsInput | string | null
    date?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    totalMinutes?: NullableIntFieldUpdateOperationsInput | number | null
    hourlyWageSnapshot?: NullableFloatFieldUpdateOperationsInput | number | null
    travelExpensesSnapshot?: NullableFloatFieldUpdateOperationsInput | number | null
    totalCalculated?: NullableFloatFieldUpdateOperationsInput | number | null
    paymentMethod?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
  }

  export type DressItemCreateManyDressInput = {
    id?: number
    barcodePrefix?: number | null
    dressName?: string | null
    sizeText?: string | null
    serialNumber?: number | null
    dressBarcode?: string | null
    location?: string | null
    locationNum?: number | null
    quantity?: number | null
    inRepair?: boolean
    notInUse?: boolean
    notInUseSince?: Date | string | null
    entryDateToRepo?: Date | string | null
    isDeleted?: boolean
    deletedAt?: Date | string | null
  }

  export type DressItemUpdateWithoutDressInput = {
    barcodePrefix?: NullableIntFieldUpdateOperationsInput | number | null
    dressName?: NullableStringFieldUpdateOperationsInput | string | null
    sizeText?: NullableStringFieldUpdateOperationsInput | string | null
    serialNumber?: NullableIntFieldUpdateOperationsInput | number | null
    dressBarcode?: NullableStringFieldUpdateOperationsInput | string | null
    location?: NullableStringFieldUpdateOperationsInput | string | null
    locationNum?: NullableIntFieldUpdateOperationsInput | number | null
    quantity?: NullableIntFieldUpdateOperationsInput | number | null
    inRepair?: BoolFieldUpdateOperationsInput | boolean
    notInUse?: BoolFieldUpdateOperationsInput | boolean
    notInUseSince?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    entryDateToRepo?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    orderItems?: OrderItemUpdateManyWithoutDressItemNestedInput
  }

  export type DressItemUncheckedUpdateWithoutDressInput = {
    id?: IntFieldUpdateOperationsInput | number
    barcodePrefix?: NullableIntFieldUpdateOperationsInput | number | null
    dressName?: NullableStringFieldUpdateOperationsInput | string | null
    sizeText?: NullableStringFieldUpdateOperationsInput | string | null
    serialNumber?: NullableIntFieldUpdateOperationsInput | number | null
    dressBarcode?: NullableStringFieldUpdateOperationsInput | string | null
    location?: NullableStringFieldUpdateOperationsInput | string | null
    locationNum?: NullableIntFieldUpdateOperationsInput | number | null
    quantity?: NullableIntFieldUpdateOperationsInput | number | null
    inRepair?: BoolFieldUpdateOperationsInput | boolean
    notInUse?: BoolFieldUpdateOperationsInput | boolean
    notInUseSince?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    entryDateToRepo?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    orderItems?: OrderItemUncheckedUpdateManyWithoutDressItemNestedInput
  }

  export type DressItemUncheckedUpdateManyWithoutDressInput = {
    id?: IntFieldUpdateOperationsInput | number
    barcodePrefix?: NullableIntFieldUpdateOperationsInput | number | null
    dressName?: NullableStringFieldUpdateOperationsInput | string | null
    sizeText?: NullableStringFieldUpdateOperationsInput | string | null
    serialNumber?: NullableIntFieldUpdateOperationsInput | number | null
    dressBarcode?: NullableStringFieldUpdateOperationsInput | string | null
    location?: NullableStringFieldUpdateOperationsInput | string | null
    locationNum?: NullableIntFieldUpdateOperationsInput | number | null
    quantity?: NullableIntFieldUpdateOperationsInput | number | null
    inRepair?: BoolFieldUpdateOperationsInput | boolean
    notInUse?: BoolFieldUpdateOperationsInput | boolean
    notInUseSince?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    entryDateToRepo?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type OrderItemCreateManyDressItemInput = {
    id?: number
    orderId?: number | null
    price?: number | null
    quantity?: number | null
    description?: string | null
    sizeText?: string | null
    repairs?: string | null
    basePrice?: number | null
    finalPrice?: number | null
    barcode?: string | null
    barcodePrefix?: number | null
    size?: string | null
    isTaken?: boolean
    isReturned?: boolean
    returnedOk?: boolean
    takenDate?: Date | string | null
    returnDate?: Date | string | null
    isDeleted?: boolean
    deletedAt?: Date | string | null
    neckAlteration?: number | null
    lengthAlteration?: string | null
    sleeveAlteration?: number | null
    alterationDetails?: string | null
    alterationDone?: boolean
  }

  export type OrderItemUpdateWithoutDressItemInput = {
    price?: NullableFloatFieldUpdateOperationsInput | number | null
    quantity?: NullableIntFieldUpdateOperationsInput | number | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    sizeText?: NullableStringFieldUpdateOperationsInput | string | null
    repairs?: NullableStringFieldUpdateOperationsInput | string | null
    basePrice?: NullableFloatFieldUpdateOperationsInput | number | null
    finalPrice?: NullableFloatFieldUpdateOperationsInput | number | null
    barcode?: NullableStringFieldUpdateOperationsInput | string | null
    barcodePrefix?: NullableIntFieldUpdateOperationsInput | number | null
    size?: NullableStringFieldUpdateOperationsInput | string | null
    isTaken?: BoolFieldUpdateOperationsInput | boolean
    isReturned?: BoolFieldUpdateOperationsInput | boolean
    returnedOk?: BoolFieldUpdateOperationsInput | boolean
    takenDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    returnDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    neckAlteration?: NullableIntFieldUpdateOperationsInput | number | null
    lengthAlteration?: NullableStringFieldUpdateOperationsInput | string | null
    sleeveAlteration?: NullableIntFieldUpdateOperationsInput | number | null
    alterationDetails?: NullableStringFieldUpdateOperationsInput | string | null
    alterationDone?: BoolFieldUpdateOperationsInput | boolean
    order?: OrderUpdateOneWithoutItemsNestedInput
  }

  export type OrderItemUncheckedUpdateWithoutDressItemInput = {
    id?: IntFieldUpdateOperationsInput | number
    orderId?: NullableIntFieldUpdateOperationsInput | number | null
    price?: NullableFloatFieldUpdateOperationsInput | number | null
    quantity?: NullableIntFieldUpdateOperationsInput | number | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    sizeText?: NullableStringFieldUpdateOperationsInput | string | null
    repairs?: NullableStringFieldUpdateOperationsInput | string | null
    basePrice?: NullableFloatFieldUpdateOperationsInput | number | null
    finalPrice?: NullableFloatFieldUpdateOperationsInput | number | null
    barcode?: NullableStringFieldUpdateOperationsInput | string | null
    barcodePrefix?: NullableIntFieldUpdateOperationsInput | number | null
    size?: NullableStringFieldUpdateOperationsInput | string | null
    isTaken?: BoolFieldUpdateOperationsInput | boolean
    isReturned?: BoolFieldUpdateOperationsInput | boolean
    returnedOk?: BoolFieldUpdateOperationsInput | boolean
    takenDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    returnDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    neckAlteration?: NullableIntFieldUpdateOperationsInput | number | null
    lengthAlteration?: NullableStringFieldUpdateOperationsInput | string | null
    sleeveAlteration?: NullableIntFieldUpdateOperationsInput | number | null
    alterationDetails?: NullableStringFieldUpdateOperationsInput | string | null
    alterationDone?: BoolFieldUpdateOperationsInput | boolean
  }

  export type OrderItemUncheckedUpdateManyWithoutDressItemInput = {
    id?: IntFieldUpdateOperationsInput | number
    orderId?: NullableIntFieldUpdateOperationsInput | number | null
    price?: NullableFloatFieldUpdateOperationsInput | number | null
    quantity?: NullableIntFieldUpdateOperationsInput | number | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    sizeText?: NullableStringFieldUpdateOperationsInput | string | null
    repairs?: NullableStringFieldUpdateOperationsInput | string | null
    basePrice?: NullableFloatFieldUpdateOperationsInput | number | null
    finalPrice?: NullableFloatFieldUpdateOperationsInput | number | null
    barcode?: NullableStringFieldUpdateOperationsInput | string | null
    barcodePrefix?: NullableIntFieldUpdateOperationsInput | number | null
    size?: NullableStringFieldUpdateOperationsInput | string | null
    isTaken?: BoolFieldUpdateOperationsInput | boolean
    isReturned?: BoolFieldUpdateOperationsInput | boolean
    returnedOk?: BoolFieldUpdateOperationsInput | boolean
    takenDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    returnDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    neckAlteration?: NullableIntFieldUpdateOperationsInput | number | null
    lengthAlteration?: NullableStringFieldUpdateOperationsInput | string | null
    sleeveAlteration?: NullableIntFieldUpdateOperationsInput | number | null
    alterationDetails?: NullableStringFieldUpdateOperationsInput | string | null
    alterationDone?: BoolFieldUpdateOperationsInput | boolean
  }

  export type OrderItemCreateManyOrderInput = {
    id?: number
    dressItemId?: number | null
    price?: number | null
    quantity?: number | null
    description?: string | null
    sizeText?: string | null
    repairs?: string | null
    basePrice?: number | null
    finalPrice?: number | null
    barcode?: string | null
    barcodePrefix?: number | null
    size?: string | null
    isTaken?: boolean
    isReturned?: boolean
    returnedOk?: boolean
    takenDate?: Date | string | null
    returnDate?: Date | string | null
    isDeleted?: boolean
    deletedAt?: Date | string | null
    neckAlteration?: number | null
    lengthAlteration?: string | null
    sleeveAlteration?: number | null
    alterationDetails?: string | null
    alterationDone?: boolean
  }

  export type PaymentCreateManyOrderInput = {
    id?: number
    customerId?: number | null
    amount: number
    paymentDate?: Date | string
    paymentMethod?: string | null
    notes?: string | null
    isDeleted?: boolean
  }

  export type PaymentObligationCreateManyOrderInput = {
    id?: number
    productId?: number | null
    amount: number
    quantity?: number
    description?: string | null
    createdAt?: Date | string
    isDeleted?: boolean
    isRefund?: boolean
    isManual?: boolean
  }

  export type OrderItemUpdateWithoutOrderInput = {
    price?: NullableFloatFieldUpdateOperationsInput | number | null
    quantity?: NullableIntFieldUpdateOperationsInput | number | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    sizeText?: NullableStringFieldUpdateOperationsInput | string | null
    repairs?: NullableStringFieldUpdateOperationsInput | string | null
    basePrice?: NullableFloatFieldUpdateOperationsInput | number | null
    finalPrice?: NullableFloatFieldUpdateOperationsInput | number | null
    barcode?: NullableStringFieldUpdateOperationsInput | string | null
    barcodePrefix?: NullableIntFieldUpdateOperationsInput | number | null
    size?: NullableStringFieldUpdateOperationsInput | string | null
    isTaken?: BoolFieldUpdateOperationsInput | boolean
    isReturned?: BoolFieldUpdateOperationsInput | boolean
    returnedOk?: BoolFieldUpdateOperationsInput | boolean
    takenDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    returnDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    neckAlteration?: NullableIntFieldUpdateOperationsInput | number | null
    lengthAlteration?: NullableStringFieldUpdateOperationsInput | string | null
    sleeveAlteration?: NullableIntFieldUpdateOperationsInput | number | null
    alterationDetails?: NullableStringFieldUpdateOperationsInput | string | null
    alterationDone?: BoolFieldUpdateOperationsInput | boolean
    dressItem?: DressItemUpdateOneWithoutOrderItemsNestedInput
  }

  export type OrderItemUncheckedUpdateWithoutOrderInput = {
    id?: IntFieldUpdateOperationsInput | number
    dressItemId?: NullableIntFieldUpdateOperationsInput | number | null
    price?: NullableFloatFieldUpdateOperationsInput | number | null
    quantity?: NullableIntFieldUpdateOperationsInput | number | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    sizeText?: NullableStringFieldUpdateOperationsInput | string | null
    repairs?: NullableStringFieldUpdateOperationsInput | string | null
    basePrice?: NullableFloatFieldUpdateOperationsInput | number | null
    finalPrice?: NullableFloatFieldUpdateOperationsInput | number | null
    barcode?: NullableStringFieldUpdateOperationsInput | string | null
    barcodePrefix?: NullableIntFieldUpdateOperationsInput | number | null
    size?: NullableStringFieldUpdateOperationsInput | string | null
    isTaken?: BoolFieldUpdateOperationsInput | boolean
    isReturned?: BoolFieldUpdateOperationsInput | boolean
    returnedOk?: BoolFieldUpdateOperationsInput | boolean
    takenDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    returnDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    neckAlteration?: NullableIntFieldUpdateOperationsInput | number | null
    lengthAlteration?: NullableStringFieldUpdateOperationsInput | string | null
    sleeveAlteration?: NullableIntFieldUpdateOperationsInput | number | null
    alterationDetails?: NullableStringFieldUpdateOperationsInput | string | null
    alterationDone?: BoolFieldUpdateOperationsInput | boolean
  }

  export type OrderItemUncheckedUpdateManyWithoutOrderInput = {
    id?: IntFieldUpdateOperationsInput | number
    dressItemId?: NullableIntFieldUpdateOperationsInput | number | null
    price?: NullableFloatFieldUpdateOperationsInput | number | null
    quantity?: NullableIntFieldUpdateOperationsInput | number | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    sizeText?: NullableStringFieldUpdateOperationsInput | string | null
    repairs?: NullableStringFieldUpdateOperationsInput | string | null
    basePrice?: NullableFloatFieldUpdateOperationsInput | number | null
    finalPrice?: NullableFloatFieldUpdateOperationsInput | number | null
    barcode?: NullableStringFieldUpdateOperationsInput | string | null
    barcodePrefix?: NullableIntFieldUpdateOperationsInput | number | null
    size?: NullableStringFieldUpdateOperationsInput | string | null
    isTaken?: BoolFieldUpdateOperationsInput | boolean
    isReturned?: BoolFieldUpdateOperationsInput | boolean
    returnedOk?: BoolFieldUpdateOperationsInput | boolean
    takenDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    returnDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    neckAlteration?: NullableIntFieldUpdateOperationsInput | number | null
    lengthAlteration?: NullableStringFieldUpdateOperationsInput | string | null
    sleeveAlteration?: NullableIntFieldUpdateOperationsInput | number | null
    alterationDetails?: NullableStringFieldUpdateOperationsInput | string | null
    alterationDone?: BoolFieldUpdateOperationsInput | boolean
  }

  export type PaymentUpdateWithoutOrderInput = {
    amount?: FloatFieldUpdateOperationsInput | number
    paymentDate?: DateTimeFieldUpdateOperationsInput | Date | string
    paymentMethod?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    customer?: CustomerUpdateOneWithoutPaymentsNestedInput
  }

  export type PaymentUncheckedUpdateWithoutOrderInput = {
    id?: IntFieldUpdateOperationsInput | number
    customerId?: NullableIntFieldUpdateOperationsInput | number | null
    amount?: FloatFieldUpdateOperationsInput | number
    paymentDate?: DateTimeFieldUpdateOperationsInput | Date | string
    paymentMethod?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
  }

  export type PaymentUncheckedUpdateManyWithoutOrderInput = {
    id?: IntFieldUpdateOperationsInput | number
    customerId?: NullableIntFieldUpdateOperationsInput | number | null
    amount?: FloatFieldUpdateOperationsInput | number
    paymentDate?: DateTimeFieldUpdateOperationsInput | Date | string
    paymentMethod?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
  }

  export type PaymentObligationUpdateWithoutOrderInput = {
    productId?: NullableIntFieldUpdateOperationsInput | number | null
    amount?: FloatFieldUpdateOperationsInput | number
    quantity?: IntFieldUpdateOperationsInput | number
    description?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    isRefund?: BoolFieldUpdateOperationsInput | boolean
    isManual?: BoolFieldUpdateOperationsInput | boolean
  }

  export type PaymentObligationUncheckedUpdateWithoutOrderInput = {
    id?: IntFieldUpdateOperationsInput | number
    productId?: NullableIntFieldUpdateOperationsInput | number | null
    amount?: FloatFieldUpdateOperationsInput | number
    quantity?: IntFieldUpdateOperationsInput | number
    description?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    isRefund?: BoolFieldUpdateOperationsInput | boolean
    isManual?: BoolFieldUpdateOperationsInput | boolean
  }

  export type PaymentObligationUncheckedUpdateManyWithoutOrderInput = {
    id?: IntFieldUpdateOperationsInput | number
    productId?: NullableIntFieldUpdateOperationsInput | number | null
    amount?: FloatFieldUpdateOperationsInput | number
    quantity?: IntFieldUpdateOperationsInput | number
    description?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    isRefund?: BoolFieldUpdateOperationsInput | boolean
    isManual?: BoolFieldUpdateOperationsInput | boolean
  }



  /**
   * Aliases for legacy arg types
   */
    /**
     * @deprecated Use CustomerCountOutputTypeDefaultArgs instead
     */
    export type CustomerCountOutputTypeArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = CustomerCountOutputTypeDefaultArgs<ExtArgs>
    /**
     * @deprecated Use EmployeeCountOutputTypeDefaultArgs instead
     */
    export type EmployeeCountOutputTypeArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = EmployeeCountOutputTypeDefaultArgs<ExtArgs>
    /**
     * @deprecated Use DressModelCountOutputTypeDefaultArgs instead
     */
    export type DressModelCountOutputTypeArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = DressModelCountOutputTypeDefaultArgs<ExtArgs>
    /**
     * @deprecated Use DressItemCountOutputTypeDefaultArgs instead
     */
    export type DressItemCountOutputTypeArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = DressItemCountOutputTypeDefaultArgs<ExtArgs>
    /**
     * @deprecated Use OrderCountOutputTypeDefaultArgs instead
     */
    export type OrderCountOutputTypeArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = OrderCountOutputTypeDefaultArgs<ExtArgs>
    /**
     * @deprecated Use CustomerDefaultArgs instead
     */
    export type CustomerArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = CustomerDefaultArgs<ExtArgs>
    /**
     * @deprecated Use AuditLogDefaultArgs instead
     */
    export type AuditLogArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = AuditLogDefaultArgs<ExtArgs>
    /**
     * @deprecated Use EmployeeDefaultArgs instead
     */
    export type EmployeeArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = EmployeeDefaultArgs<ExtArgs>
    /**
     * @deprecated Use ShiftDefaultArgs instead
     */
    export type ShiftArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = ShiftDefaultArgs<ExtArgs>
    /**
     * @deprecated Use DressModelDefaultArgs instead
     */
    export type DressModelArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = DressModelDefaultArgs<ExtArgs>
    /**
     * @deprecated Use DressItemDefaultArgs instead
     */
    export type DressItemArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = DressItemDefaultArgs<ExtArgs>
    /**
     * @deprecated Use OrderDefaultArgs instead
     */
    export type OrderArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = OrderDefaultArgs<ExtArgs>
    /**
     * @deprecated Use PaymentDefaultArgs instead
     */
    export type PaymentArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = PaymentDefaultArgs<ExtArgs>
    /**
     * @deprecated Use PaymentObligationDefaultArgs instead
     */
    export type PaymentObligationArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = PaymentObligationDefaultArgs<ExtArgs>
    /**
     * @deprecated Use OrderItemDefaultArgs instead
     */
    export type OrderItemArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = OrderItemDefaultArgs<ExtArgs>
    /**
     * @deprecated Use PriceListDefaultArgs instead
     */
    export type PriceListArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = PriceListDefaultArgs<ExtArgs>
    /**
     * @deprecated Use SystemSettingDefaultArgs instead
     */
    export type SystemSettingArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = SystemSettingDefaultArgs<ExtArgs>
    /**
     * @deprecated Use PriceRuleDefaultArgs instead
     */
    export type PriceRuleArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = PriceRuleDefaultArgs<ExtArgs>
    /**
     * @deprecated Use PageVisitLogDefaultArgs instead
     */
    export type PageVisitLogArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = PageVisitLogDefaultArgs<ExtArgs>
    /**
     * @deprecated Use EmailLogDefaultArgs instead
     */
    export type EmailLogArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = EmailLogDefaultArgs<ExtArgs>

  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number
  }

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF
}