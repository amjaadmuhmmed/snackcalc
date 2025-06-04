
describe('Billing Workflow', () => {
  const currencySymbol = '₹'; // Assuming default or this is set in Cypress env

  beforeEach(() => {
    // Visit the home page before each test in this block
    cy.visit('/');
    // Ensure items are loaded (adjust item name and price as per your data)
    // This is a simple check; more robust would be to wait for a specific element
    // that indicates items are ready.
    cy.contains('Shawaya', { timeout: 10000 }).should('be.visible'); // Updated item
  });

  it('should add an item to the bill and update total', () => {
    const itemName = 'Shawaya'; 
    const itemPrice = 300;   

    // Find the Shawaya button and click it
    cy.contains('button', itemName).click();

    // Verify Shawaya is in selected items
    cy.get('ul').contains('li', itemName).should('be.visible');
    cy.get('ul').contains('li', itemName).find('input[type="number"]').should('have.value', itemPrice.toString());
    cy.get('ul').contains('li', itemName).find('span.font-medium').should('contain.text', `${currencySymbol}${itemPrice.toFixed(2)}`);

    // Verify total
    cy.contains('span', 'Total:')
      .next('span.badge')
      .should($badge => {
        const text = $badge.text();
        expect(text).to.match(new RegExp(`${currencySymbol}\\d+\\.\\d{2}`)); // Wait for format
        expect(text).to.contain(`${currencySymbol}${itemPrice.toFixed(2)}`); // Check specific value
      });
  });

  it('should add multiple items and update quantity and total', () => {
    const item1Name = 'Shawaya'; 
    const item1Price = 300;    
    const item2Name = 'Coffee';    
    const item2Price = 15;   

    // Add Shawaya twice
    cy.contains('button', item1Name).click();
    cy.contains('ul li', item1Name).find('button[aria-label*="Increase quantity"]').click();

    // Verify Shawaya quantity and subtotal
    cy.get('ul').contains('li', item1Name).find('span.badge').contains('2').should('be.visible');
    cy.get('ul').contains('li', item1Name).find('span.font-medium').should('contain.text', `${currencySymbol}${(item1Price * 2).toFixed(2)}`);

    // Add Coffee
    cy.contains('button', item2Name).click();

    // Verify Coffee is in selected items
    cy.get('ul').contains('li', item2Name).should('be.visible');

    // Verify total
    const expectedTotal = (item1Price * 2) + item2Price;
    cy.contains('span', 'Total:')
      .next('span.badge')
      .should($badge => {
        const text = $badge.text();
        expect(text).to.match(new RegExp(`${currencySymbol}\\d+\\.\\d{2}`));
        expect(text).to.contain(`${currencySymbol}${expectedTotal.toFixed(2)}`);
      });
  });

  it('should allow changing the price of a selected item', () => {
    const itemName = 'Shawaya';
    const originalPrice = 300;
    const newPrice = 320; // Example new price for Shawaya

    cy.contains('button', itemName).click(); // Add Shawaya

    // Change price
    cy.get('ul').contains('li', itemName).find('input[type="number"]').clear().type(newPrice.toString()).blur();

    // Verify new subtotal for the item
    cy.get('ul').contains('li', itemName).find('span.font-medium').should('contain.text', `${currencySymbol}${newPrice.toFixed(2)}`);

    // Verify overall total
    cy.contains('span', 'Total:')
      .next('span.badge')
      .should($badge => {
        const text = $badge.text();
        expect(text).to.match(new RegExp(`${currencySymbol}\\d+\\.\\d{2}`));
        expect(text).to.contain(`${currencySymbol}${newPrice.toFixed(2)}`);
      });
  });

  it('should add service charge and update total', () => {
    const itemName = 'Shawaya';
    const itemPrice = 300;
    const serviceCharge = 25; // Example service charge

    cy.contains('button', itemName).click(); // Add Shawaya

    // Add service charge
    cy.get('input#service-charge').clear().type(serviceCharge.toString()).blur();

    // Verify total
    const expectedTotal = itemPrice + serviceCharge;
    cy.contains('span', 'Total:')
      .next('span.badge')
      .should($badge => {
        const text = $badge.text();
        expect(text).to.match(new RegExp(`${currencySymbol}\\d+\\.\\d{2}`));
        expect(text).to.contain(`${currencySymbol}${expectedTotal.toFixed(2)}`);
      });
  });

  it('should save a bill and then allow starting a new order', () => {
    const itemName = 'Shawaya';
    cy.contains('button', itemName).click();

    // Click "Save Bill"
    cy.contains('button', 'Save Bill').click();
    cy.contains('button', /Update Bill|Edit Items/).should('be.visible'); // Button text changes

    // Toast for bill saved (optional, depends on exact toast text)
    // cy.contains('Bill saved successfully!').should('be.visible');

    // Click "New Order"
    cy.contains('button', 'New Order').click();

    // Verify selected items are cleared
    cy.get('ul').contains('li', itemName).should('not.exist');
    cy.contains('p', 'No items selected.').should('be.visible');

    // Verify total is reset (assuming service charge also resets)
    cy.contains('span', 'Total:')
        .next('span.badge')
        .should('contain.text', `${currencySymbol}0.00`); // Ensure it's properly zeroed
    cy.contains('button', 'Save Bill').should('be.visible'); // Button text reverts
  });
});
