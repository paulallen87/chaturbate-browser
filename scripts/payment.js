/* eslint strict: 0 */

((doc) => {
  const form = doc.querySelector('form[action="/tipping/purchase_tokens/"]');
  form.querySelector('input#bitcoin').click();
  form.querySelector('input#btc_desired_tokens').value = '<PAYMENT_AMOUNT>';
  form.querySelector('input[type="submit"]').click();
})(document);
