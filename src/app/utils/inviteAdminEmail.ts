export const inviteAdminEmail = (
  fullName: string,
  email: string,
  password: string,
) => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Admin Account Created</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f8;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f6f8;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">

          <!-- Header -->
          <tr>
            <td style="background-color:#0f172a;padding:32px 36px;text-align:center;">
              <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 12px;">
                <tr>
                  <td style="background-color:#1e293b;border-radius:8px;width:36px;height:36px;text-align:center;vertical-align:middle;">
                    <span style="font-size:18px;line-height:36px;">🛡️</span>
                  </td>
                  <td style="padding-left:10px;vertical-align:middle;">
                    <span style="font-size:17px;font-weight:600;color:#f1f5f9;">MediCheck</span>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:13px;color:#94a3b8;letter-spacing:0.4px;">Admin account created</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 36px;">

              <h1 style="margin:0 0 8px;font-size:20px;font-weight:600;color:#0f172a;">Welcome, ${fullName}!</h1>
              <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.7;">
                Your admin account has been created by a super admin. Use the credentials below to log in and access the admin dashboard.
              </p>

              <!-- Credentials -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:20px;">
                <tr>
                  <td style="padding:14px 16px;border-bottom:1px solid #e2e8f0;background-color:#f8fafc;">
                    <table cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td style="width:32px;height:32px;background-color:#dbeafe;border-radius:6px;text-align:center;vertical-align:middle;font-size:15px;">📧</td>
                        <td style="padding-left:12px;vertical-align:middle;">
                          <p style="margin:0 0 2px;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.8px;">Email</p>
                          <p style="margin:0;font-size:13px;font-weight:600;color:#0f172a;font-family:'Courier New',monospace;">${email}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 16px;background-color:#f8fafc;">
                    <table cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td style="width:32px;height:32px;background-color:#dcfce7;border-radius:6px;text-align:center;vertical-align:middle;font-size:15px;">🔑</td>
                        <td style="padding-left:12px;vertical-align:middle;">
                          <p style="margin:0 0 2px;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.8px;">Temporary password</p>
                          <p style="margin:0;font-size:13px;font-weight:600;color:#0f172a;font-family:'Courier New',monospace;">${password}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Warning -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
                <tr>
                  <td style="background-color:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:12px 16px;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="font-size:16px;padding-right:10px;vertical-align:top;padding-top:1px;">⚠️</td>
                        <td style="font-size:13px;color:#c2410c;line-height:1.6;">
                          Change your password immediately after first login. Do not share these credentials with anyone.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Steps -->
              <p style="margin:0 0 12px;font-size:12px;font-weight:700;color:#0f172a;text-transform:uppercase;letter-spacing:0.8px;">Getting started</p>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;">
                <tr>
                  <td style="width:24px;height:24px;background-color:#0f172a;border-radius:50%;text-align:center;vertical-align:middle;font-size:11px;font-weight:700;color:#ffffff;">1</td>
                  <td style="padding-left:12px;font-size:13px;color:#64748b;line-height:1.6;vertical-align:middle;">Log in using the credentials above</td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;">
                <tr>
                  <td style="width:24px;height:24px;background-color:#0f172a;border-radius:50%;text-align:center;vertical-align:middle;font-size:11px;font-weight:700;color:#ffffff;">2</td>
                  <td style="padding-left:12px;font-size:13px;color:#64748b;line-height:1.6;vertical-align:middle;">Go to <strong>Profile Settings</strong> and update your password</td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
                <tr>
                  <td style="width:24px;height:24px;background-color:#0f172a;border-radius:50%;text-align:center;vertical-align:middle;font-size:11px;font-weight:700;color:#ffffff;">3</td>
                  <td style="padding-left:12px;font-size:13px;color:#64748b;line-height:1.6;vertical-align:middle;">Set up your admin profile and start managing the platform</td>
                </tr>
              </table>

              <!-- Divider -->
              <div style="height:1px;background-color:#e2e8f0;margin-bottom:20px;"></div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 36px;text-align:center;">
              <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#475569;">MediCheck Team</p>
              <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
                This account was created by a super admin. Contact support if this was a mistake.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
};