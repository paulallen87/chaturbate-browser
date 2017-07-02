/* eslint strict: 0 */

((doc) => {
  doc.querySelector('#copy-tab').click();
  const amount =
      doc.querySelector('.manual-box__amount__value span').innerText;
  const address =
      doc.querySelector('.manual-box__address__wrapper__value').innerText;

  return {
    address: address,
    amount: amount,
  };
})(document);
