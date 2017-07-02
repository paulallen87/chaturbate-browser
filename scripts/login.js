/* eslint strict: 0 */

((doc) => {
  const form = doc.querySelector('form[action="/auth/login/"]');
  form.querySelector('input#id_username').value = '<LOGIN_USERNAME>';
  form.querySelector('input#id_password').value = '<LOGIN_PASSWORD>';
  form.querySelector('input[type="submit"]').click();
})(document);
