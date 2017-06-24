((d) => {

  d.querySelector('#copy-tab').click();
  const amount = d.querySelector('.manual-box__amount__value span').innerText;
  const address = d.querySelector('.manual-box__address__wrapper__value').innerText;

  return {
    amount: amount,
    address: address
  };

})(document);