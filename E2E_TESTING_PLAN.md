
# Snackulator: 10-Day Manual End-to-End Testing Plan

## 1. Introduction
This document provides a 10-day scenario-based testing plan to manually validate all core functionalities of the Snackulator application. The goal is to simulate real-world usage and verify the accuracy of stock management, financial calculations, and data persistence.

**Please perform these steps in order, as each day's actions build upon the previous ones.**

---

## 2. Initial Setup (Day 0)

Before starting, ensure your database is in a clean state or use this as the foundational data.

### **Step 2.1: Admin Login**
1.  Go to the main page.
2.  Click the **Admin** icon (top right).
3.  Enter the admin password to log in.

### **Step 2.2: Add Suppliers**
1.  Navigate to the "Purchasing & Suppliers" tab.
2.  Click **Add New Supplier** and create the following:
    *   **Name:** `Daily Beverages Co.` (Add any phone/address if you wish)
    *   **Name:** `SnackProvisions Inc.`
    *   **Name:** `General Supplies Ltd.`

### **Step 2.3: Add Items (Initial Stock)**
1.  Navigate to the "Item Management" tab.
2.  Add the following items with their initial stock, selling price, and cost price:

| Name | Category | Selling Price (₹) | Cost Price (₹) | Stock Quantity |
| :--- | :--- | :--- | :--- | :--- |
| Coffee | Beverage | 15 | 8 | 100 |
| Tea | Beverage | 10 | 5 | 100 |
| Samosa | Snack | 12 | 7 | 50 |
| Shawarma | Snack | 80 | 45 | 30 |
| Water Bottle | Beverage | 20 | 12 | 150 |

### **Step 2.4: Add Customers**
1.  Navigate to the "Sales & Customer" tab.
2.  Click **Add New Customer** and create the following:
    *   **Name:** `Alice` (Phone: `9876543210`)
    *   **Name:** `Bob` (Phone: `8765432109`)

### **Step 2.5: Logout**
1.  Click **Logout Admin** to return to the main sales page.

---

## 3. Daily Scenarios

### **Day 1: Basic Sales**
1.  Create a bill: 2 Coffee, 1 Samosa.
2.  Save the bill (**Save Bill**, not "New Order").
3.  Create another bill: 1 Tea, 1 Shawarma.
4.  Save the bill.

### **Day 2: Sales with Customer & Tags**
1.  Create a bill for customer **Alice**: 5 Tea, 5 Samosa. Add tag `office_party`.
2.  Save the bill.
3.  Create a bill for customer **Bob**: 2 Shawarma. Add service charge of `20`.
4.  Save the bill.

### **Day 3: Purchase Order**
1.  Log in as Admin.
2.  Go to "Purchasing & Suppliers" -> **New Purchase Order**.
3.  Select supplier `SnackProvisions Inc.`.
4.  Add `50 Samosas` at a purchase cost of `₹7` each.
5.  Save the purchase order.
6.  Log out.

### **Day 4: Record an Expense**
1.  Log in as Admin.
2.  Go to "Income & Expenses" -> **Add New Expense**.
3.  **Category:** `Utilities`, **Description:** `Electricity Bill - Month End`, **Amount:** `1200`. Add tag `monthly`.
4.  Save the expense.
5.  Log out.

### **Day 5: Complex Sale**
1.  Create a bill: 10 Water Bottles, 4 Coffee.
2.  The customer wants a discount on Coffee. Edit the price of Coffee in the selected items list to `₹13`.
3.  Add a tag: `bulk_order`.
4.  Save the bill.

### **Day 6: Record Income**
1.  Log in as Admin.
2.  Go to "Income & Expenses" -> **Add New Income**.
3.  **Category:** `Other`, **Description:** `Sale of old newspapers`, **Amount:** `150`.
4.  Save the income.
5.  Log out.

### **Day 7: Multi-Item Purchase**
1.  Log in as Admin.
2.  Go to "Purchasing & Suppliers" -> **New Purchase Order**.
3.  Select supplier `Daily Beverages Co.`.
4.  Add `100 Coffee` (cost `₹8`) and `100 Tea` (cost `₹5`). Add tag `restock`.
5.  Save the purchase order.
6.  Log out.

### **Day 8: High Volume Sales**
1.  Create bill: 8 Coffee, 8 Samosa. Save.
2.  Create bill: 5 Shawarma. Save.
3.  Create bill: 15 Water Bottle. Save.

### **Day 9: Editing a Bill**
1.  Log in as Admin -> "Sales & Customer" -> **Sales Order History**.
2.  Find the bill from Day 1 with "1 Tea, 1 Shawarma". Click **Edit**.
3.  This takes you back to the main page with the bill loaded. Add `1 Water Bottle` to this bill.
4.  Click **Update Bill**.
5.  Log out.

### **Day 10: Final Entries**
1.  Create bill: 10 Samosa. Save.
2.  Log in as Admin.
3.  Go to "Income & Expenses" -> **Add New Expense**.
4.  **Category:** `Rent`, **Description:** `Monthly Rent`, **Amount:** `5000`. Add tag `monthly`.
5.  Log out.

---

## 4. Final Validation

After completing all 10 days, perform the following checks.

### **Step 4.1: Stock Validation**
- Log in as Admin and go to "Item Management".
- The final stock counts should match these calculated values:

| Item | Initial | Purchased | Sold | **Expected Final Stock** |
| :--- | :--- | :--- | :--- | :--- |
| Coffee | 100 | 100 | 2 + 4 + 8 = 14 | **186** |
| Tea | 100 | 100 | 1 + 5 + 1 = 7 | **193** |
| Samosa | 50 | 50 | 1 + 5 + 8 + 10 = 24 | **76** |
| Shawarma | 30 | 0 | 1 + 2 + 5 = 8 | **22** |
| Water Bottle| 150 | 0 | 10 + 15 + 1 = 26 | **124** |

### **Step 4.2: Financial Validation**

#### **Sales Total**
1.  Go to Admin -> "Sales & Customer" -> **Sales Order History**.
2.  Clear any date filters to show all transactions.
3.  The **"Total for Filtered Transactions"** should be **₹2072.00**.
    *   _Day 1_: (2\*15 + 1\*12) + (1\*10 + 1\*80) = 42 + 90 = **₹132**
    *   _Day 2_: (5\*10 + 5\*12) + (2\*80 + 20 service) = 110 + 180 = **₹290**
    *   _Day 5_: (10\*20 + 4\*13) = **₹252**
    *   _Day 8_: (8\*15 + 8\*12) + (5\*80) + (15\*20) = 216 + 400 + 300 = **₹916**
    *   _Day 9 (Updated)_: (1\*10 + 1\*80 + 1\*20) = **₹110**
    *   _Day 10_: (10\*12) = **₹120**
    *   **Total = 132 + 290 + 252 + 916 + 110 + 120 = ₹2020.00** - Let me re-check my math.
    *   Day 1: 42 + 90 = 132
    *   Day 2: 110 + 180 = 290
    *   Day 5: 200 + 52 = 252
    *   Day 8: 216 + 400 + 300 = 916
    *   Day 9: 110
    *   Day 10: 120
    *   **Correct Total = 132 + 290 + 252 + 916 + 110 + 120 = ₹1820.00**

#### **Purchases Total**
1.  Go to Admin -> "Purchasing & Suppliers" -> **Purchase Order History**.
2.  Clear any date filters.
3.  The **"Total for Filtered Purchases"** should be **₹1650.00**.
    *   _Day 3_: 50 \* 7 = **₹350**
    *   _Day 7_: (100 \* 8) + (100 \* 5) = 800 + 500 = **₹1300**
    *   **Total = 350 + 1300 = ₹1650.00**

#### **Income & Expense Totals**
1.  Go to Admin -> "Income & Expenses" -> **View Transaction History**.
2.  Clear any date filters.
3.  Check the footer totals:
    *   **Total Income:** **₹150.00**
    *   **Total Expense:** **₹6200.00** (1200 + 5000)
    *   **Net Total:** **-₹6050.00**

### **Step 4.3: Tag Filtering Validation**
1.  On the **Sales Order History** page, search for `office_party`. Only the bill from Day 2 should appear. Clear search.
2.  On the **Purchase Order History** page, search for `restock`. Only the purchase from Day 7 should appear. Clear search.
3.  On the **Income & Expense History** page, search for `monthly`. The two expenses from Day 4 and Day 10 should appear.

This completes the E2E test. If all numbers and filters match, the application is working as expected.
