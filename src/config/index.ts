import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

export default {
  env: process.env.NODE_ENV,
  port: process.env.PORT,
  super_admin_password: process.env.SUPER_ADMIN_PASSWORD,
  bcrypt_salt_rounds: process.env.BCRYPT_SALT_ROUNDS,
  mail: process.env.OWN_MAIL,
  mail_password: process.env.OWN_MAIL_PASS,
  brevo_mail: process.env.BREVO_MAIL,
  brevo_password: process.env.BREVO_MAIL_PASS,
  base_url_server: process.env.BASE_URL_SERVER,
  base_url_client: process.env.BASE_URL_CLIENT,
  google_client_id: process.env.GOOGLE_CLIENT_ID,
  google_client_secret: process.env.GOOGLE_CLIENT_SECRET,
  google_callback_url: process.env.GOOGLE_CALLBACK_URL,

  facebook_app_id: process.env.FACEBOOK_APP_ID,
  facebook_app_secret: process.env.FACEBOOK_APP_SECRET,
  facebook_callback_url: process.env.FACEBOOK_CALLBACK_URL,
  jwt: {
    access_secret: process.env.JWT_ACCESS_SECRET,
    access_expires_in: process.env.JWT_ACCESS_EXPIRES_IN,
    refresh_secret: process.env.JWT_REFRESH_SECRET,
    refresh_expires_in: process.env.JWT_REFRESH_EXPIRES_IN,
  },
  do_space: {
    endpoints: process.env.DO_SPACE_ENDPOINT,
    access_key: process.env.DO_SPACE_ACCESS_KEY,
    secret_key: process.env.DO_SPACE_SECRET_KEY,
    bucket: process.env.DO_SPACE_BUCKET,
  },
  stripe: {
    published_key: process.env.STRIPE_PUBLISHED_KEY,
    stripe_secret_key: process.env.STRIPE_SECRET_KEY,
    stripe_webhook: process.env.STRIPE_WEBHOOK,
  },
  paypal: {
    mode: process.env.PAYPAL_MODE,
    client_secret: process.env.CLIENT_SECRET,
    client_id: process.env.CLIENT_ID,
  },
};
