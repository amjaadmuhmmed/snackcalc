
describe('Billing Workflow', () => {
  const currencySymbol = '₹'; // Assuming default or this is set in Cypress env

  beforeEach(() => {
    // Visit the home page before each test in this block
    cy.visit('/');
    // Ensure items are loaded (adjust item name and price as per your data)
    // This is a simple check; more robust would be to wait for a specific element
    // that indicates items are ready.
    cy.contains('Samosa', { timeout: 10000 }).should('be.visible'); // Example item
  });

  it('should add an item to the bill and update total', () => {
    const itemName = 'Samosa'; // Replace with an actual item name from your app
    const itemPrice = 15;   // Replace with the item's price

    // Find the Samosa button and click it
    cy.contains('button', itemName).click();

    // Verify Samosa is in selected items
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
    const item1Name = 'Samosa'; // Replace
    const item1Price = 15;    // Replace
    const item2Name = 'Tea';    // Replace with another item
    const item2Price = 10;   // Replace

    // Add Samosa twice
    cy.contains('button', item1Name).click();
    cy.contains('ul li', item1Name).find('button[aria-label*="Increase quantity"]').click();

    // Verify Samosa quantity and subtotal
    cy.get('ul').contains('li', item1Name).find('span.badge').contains('2').should('be.visible');
    cy.get('ul').contains('li', item1Name).find('span.font-medium').should('contain.text', `${currencySymbol}${(item1Price * 2).toFixed(2)}`);

    // Add Tea
    cy.contains('button', item2Name).click();

    // Verify Tea is in selected items
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
    const itemName = 'Samosa';
    const originalPrice = 15;
    const newPrice = 20;

    cy.contains('button', itemName).click(); // Add Samosa

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
    const itemName = 'Samosa';
    const itemPrice = 15;
    const serviceCharge = 5;

    cy.contains('button', itemName).click(); // Add Samosa

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
    const itemName = 'Samosa';
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
