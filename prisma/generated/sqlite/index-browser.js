
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  Serializable: 'Serializable'
});

exports.Prisma.CustomerScalarFieldEnum = {
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

exports.Prisma.AuditLogScalarFieldEnum = {
  id: 'id',
  entityType: 'entityType',
  entityId: 'entityId',
  action: 'action',
  changesJson: 'changesJson',
  createdAt: 'createdAt',
  employeeId: 'employeeId'
};

exports.Prisma.EmployeeScalarFieldEnum = {
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

exports.Prisma.ShiftScalarFieldEnum = {
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

exports.Prisma.DressModelScalarFieldEnum = {
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

exports.Prisma.DressItemScalarFieldEnum = {
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

exports.Prisma.OrderScalarFieldEnum = {
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

exports.Prisma.PaymentScalarFieldEnum = {
  id: 'id',
  customerId: 'customerId',
  orderId: 'orderId',
  amount: 'amount',
  paymentDate: 'paymentDate',
  paymentMethod: 'paymentMethod',
  notes: 'notes',
  isDeleted: 'isDeleted'
};

exports.Prisma.PaymentObligationScalarFieldEnum = {
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

exports.Prisma.OrderItemScalarFieldEnum = {
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

exports.Prisma.PriceListScalarFieldEnum = {
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

exports.Prisma.SystemSettingScalarFieldEnum = {
  id: 'id',
  key: 'key',
  value: 'value',
  name: 'name',
  category: 'category',
  notes: 'notes',
  type: 'type'
};

exports.Prisma.PriceRuleScalarFieldEnum = {
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

exports.Prisma.PageVisitLogScalarFieldEnum = {
  id: 'id',
  pageUrl: 'pageUrl',
  employeeId: 'employeeId',
  employeeName: 'employeeName',
  timestamp: 'timestamp',
  loadingError: 'loadingError',
  isGuest: 'isGuest'
};

exports.Prisma.EmailLogScalarFieldEnum = {
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

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};


exports.Prisma.ModelName = {
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

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
