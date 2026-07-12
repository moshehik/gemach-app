| טבלה | שדה במערכת (Prisma) | שדה מקביל באקסס | רשומות חדש | רשומות אקסס | פער |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Customer** | `houseNum` | בית | 15621 | 15624 | **-3** |
| **Customer** | `notes` | הערות | 277 | 276 | **+1** |
| **Employee** | `roleId` | מס_מחלקה | 90 | 91 | **-1** |
| **Shift** | `employeeId` | קוד_עובד | 13809 | 13957 | **-148** |
| **Shift** | `entryTime` | שעת_כניסה | 13807 | 13956 | **-149** |
| **Shift** | `exitTime` | שעת_יציאה | 13796 | 13941 | **-145** |
| **Shift** | `hebrewDate` | תאריך_עברי | 13788 | 13940 | **-152** |
| **DressModel** | `name` | שם_שמלה | 115 | 111 | **+4** |
| **DressModel** | `exitDateFromRepo` | תאריך_יציאה_מהמאגר | 53 | 55 | **-2** |
| **Order** | `employeeId` | קוד_עובד | 16436 | 16481 | **-45** |
| **Payment** | `paymentDate` | תאריך תשלום | 41746 | 41760 | **-14** |
| **Payment** | `notes` | הערות | 28911 | 28914 | **-3** |
| **PaymentObligation** | `description` | תיאור | 34114 | 34121 | **-7** |
| **PaymentObligation** | `isRefund` | זיכוי | 142071 | 142303 | **-232** |
| **PaymentObligation** | `orderItemId` | קוד_פריט | 0 | 102773 | **-102773** |
| **OrderItem** | `id` | קוד_פריט | 77834 | 77950 | **-116** |
| **OrderItem** | `orderId` | קוד_הזמנה | 77834 | 77925 | **-91** |
| **OrderItem** | `quantity` | כמות | 77834 | 77945 | **-111** |
| **OrderItem** | `barcodePrefix` | בר_קוד_קידומת | 77834 | 77950 | **-116** |
| **OrderItem** | `size` | מידה | 77834 | 77950 | **-116** |
| **OrderItem** | `isTaken` | נלקח | 77834 | 77950 | **-116** |
| **OrderItem** | `isReturned` | הוחזר | 77834 | 77950 | **-116** |
| **OrderItem** | `returnedOk` | חזר_תקין | 77834 | 77950 | **-116** |
| **OrderItem** | `orderDate` | תאריך_הזמנה | 53061 | 53284 | **-223** |
| **OrderItem** | `isDeleted` | מחוק | 77834 | 77950 | **-116** |
| **OrderItem** | `deletedAt` | תאריך_מחיקה | 10785 | 10788 | **-3** |
| **OrderItem** | `neckAlteration` | תיקון_צוואר | 77834 | 77950 | **-116** |
| **OrderItem** | `lengthAlteration` | תיקון_אורך | 25197 | 25221 | **-24** |
| **OrderItem** | `sleeveAlteration` | תיקון_שרוול | 77834 | 77950 | **-116** |
| **OrderItem** | `alterationDetails` | פירוט_תיקון | 31598 | 31614 | **-16** |
| **OrderItem** | `alterationDone` | בוצע_תיקון | 77834 | 77950 | **-116** |
| **SystemSetting** | `category` | קטגוריה | 26 | 66 | **-40** |
| **SystemSetting** | `notes` | הערות | 23 | 5 | **+18** |

