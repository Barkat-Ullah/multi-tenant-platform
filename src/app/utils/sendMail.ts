import nodemailer from 'nodemailer';

export const generateOtpEmail = (otp: string) => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>OTP Verification</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f8;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f6f8;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">

          <!-- Header -->
          <tr>
            <td style="background-color:#0f172a;padding:28px 36px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Security verification</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 36px;">

              <h1 style="margin:0 0 8px;font-size:20px;font-weight:600;color:#0f172a;">Your verification code</h1>
              <p style="margin:0 0 28px;font-size:14px;color:#64748b;line-height:1.7;">
                Use the code below to verify your identity. Do not share it with anyone.
              </p>

              <!-- OTP Box -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                <tr>
                  <td style="background-color:#f8fafc;border:1.5px dashed #cbd5e1;border-radius:8px;padding:24px 20px;text-align:center;">
                    <p style="margin:0;font-size:40px;font-weight:700;color:#0f172a;letter-spacing:12px;text-indent:12px;font-family:'Courier New',monospace;">${otp}</p>
                  </td>
                </tr>
              </table>

              <!-- Expiry -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                <tr>
                  <td style="background-color:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="font-size:15px;padding-right:10px;vertical-align:top;">⏱</td>
                        <td style="font-size:13px;color:#92400e;line-height:1.6;">
                          This code expires in <strong>10 minutes</strong>. If you did not request this, ignore this email.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <div style="height:1px;background-color:#e2e8f0;"></div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:18px 36px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                This is an automated message. Please do not reply.
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

export const inviteClinicEmail = (
  fullName: string,
  email: string,
  password: string,
) => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Clinic Account Created</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f8;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f6f8;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">

          <!-- Header -->
          <tr>
            <td style="background-color:#0f6e56;padding:32px 36px;text-align:center;">
              <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 12px;">
                <tr>
                  <td style="background-color:#1d9e75;border-radius:8px;width:36px;height:36px;text-align:center;vertical-align:middle;">
                    <span style="font-size:18px;line-height:36px;">🏥</span>
                  </td>
                  <td style="padding-left:10px;vertical-align:middle;">
                    <span style="font-size:17px;font-weight:600;color:#e1f5ee;">MediCheck</span>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:13px;color:#9fe1cb;letter-spacing:0.4px;">Clinic account created</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 36px;">

              <h1 style="margin:0 0 8px;font-size:20px;font-weight:600;color:#0f172a;">Welcome, ${fullName}!</h1>
              <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.7;">
                Your clinic account has been created by an admin. Use the credentials below to log in and complete your profile.
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
                  <td style="width:24px;height:24px;background-color:#0f6e56;border-radius:50%;text-align:center;vertical-align:middle;font-size:11px;font-weight:700;color:#ffffff;">1</td>
                  <td style="padding-left:12px;font-size:13px;color:#64748b;line-height:1.6;vertical-align:middle;">Log in using the credentials above</td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;">
                <tr>
                  <td style="width:24px;height:24px;background-color:#0f6e56;border-radius:50%;text-align:center;vertical-align:middle;font-size:11px;font-weight:700;color:#ffffff;">2</td>
                  <td style="padding-left:12px;font-size:13px;color:#64748b;line-height:1.6;vertical-align:middle;">Go to <strong>Profile Settings</strong> and update your password</td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
                <tr>
                  <td style="width:24px;height:24px;background-color:#0f6e56;border-radius:50%;text-align:center;vertical-align:middle;font-size:11px;font-weight:700;color:#ffffff;">3</td>
                  <td style="padding-left:12px;font-size:13px;color:#64748b;line-height:1.6;vertical-align:middle;">Set up your clinic time slots and start accepting appointments</td>
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
                This account was created by an admin. Contact support if this was a mistake.
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

export const clinicAssignedEmail = (
  clinicName: string,
  organizerCompany: string,
  requestId: string,
  serviceName: string,
  totalDrivers: string,
) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>New Request Assigned</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f8;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f6f8;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
          <tr>
            <td style="background-color:#0f6e56;padding:32px 36px;text-align:center;">
              <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 12px;">
                <tr>
                  <td style="background-color:#1d9e75;border-radius:8px;width:36px;height:36px;text-align:center;vertical-align:middle;">
                    <span style="font-size:18px;line-height:36px;">🏥</span>
                  </td>
                  <td style="padding-left:10px;vertical-align:middle;">
                    <span style="font-size:17px;font-weight:600;color:#e1f5ee;">MediCheck</span>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:12px;color:#9fe1cb;text-transform:uppercase;letter-spacing:1px;">New Request Assigned</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 36px;">
              <h1 style="margin:0 0 8px;font-size:20px;font-weight:600;color:#0f172a;">Hi ${clinicName},</h1>
              <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.7;">
                A new organizer request has been assigned to your clinic by the admin. Please review the details below and prepare to receive the drivers.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:24px;">
                <tr>
                  <td colspan="2" style="background-color:#0f6e56;padding:12px 16px;">
                    <p style="margin:0;font-size:11px;font-weight:700;color:#d1fae5;text-transform:uppercase;letter-spacing:1px;">Request Details</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;width:40%;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Request ID</p>
                    <p style="margin:4px 0 0;font-size:12px;font-weight:600;color:#0f172a;font-family:'Courier New',monospace;">${requestId}</p>
                  </td>
                  <td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;border-left:1px solid #f1f5f9;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Status</p>
                    <p style="margin:4px 0 0;font-size:13px;font-weight:700;color:#0f6e56;">✅ Confirmed</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Company</p>
                    <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#0f172a;">🏢 ${organizerCompany}</p>
                  </td>
                  <td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;border-left:1px solid #f1f5f9;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Service</p>
                    <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#0f172a;">🩺 ${serviceName}</p>
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding:14px 16px;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Total Drivers</p>
                    <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#0f172a;">👥 ${totalDrivers}</p>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                <tr>
                  <td style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 16px;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="font-size:16px;padding-right:10px;vertical-align:top;">📌</td>
                        <td style="font-size:13px;color:#166534;line-height:1.6;">
                          The organizer will send their drivers to your clinic. Once they arrive, please complete the medical assessments and upload the records via the platform.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <div style="height:1px;background-color:#e2e8f0;"></div>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 36px;text-align:center;">
              <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#475569;">MediCheck Team</p>
              <p style="margin:0;font-size:12px;color:#94a3b8;">This is an automated message. Please do not reply.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

export const organizerRequestConfirmedEmail = (
  organizerName: string,
  companyName: string,
  requestId: string,
  clinicName: string,
  serviceName: string,
) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Request Confirmed</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f8;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f6f8;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
          <tr>
            <td style="background-color:#0f172a;padding:32px 36px;text-align:center;">
              <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 12px;">
                <tr>
                  <td style="background-color:#1e293b;border-radius:8px;width:36px;height:36px;text-align:center;vertical-align:middle;">
                    <span style="font-size:18px;line-height:36px;">✅</span>
                  </td>
                  <td style="padding-left:10px;vertical-align:middle;">
                    <span style="font-size:17px;font-weight:600;color:#f1f5f9;">MediCheck</span>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Request Confirmed</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 36px;">
              <h1 style="margin:0 0 8px;font-size:20px;font-weight:600;color:#0f172a;">Hi ${organizerName},</h1>
              <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.7;">
                Your request for <strong>${companyName}</strong> has been confirmed by the admin. A clinic has been assigned — please add your drivers to the request so they can be processed.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:24px;">
                <tr>
                  <td colspan="2" style="background-color:#1e293b;padding:12px 16px;">
                    <p style="margin:0;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Request Summary</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;width:40%;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Request ID</p>
                    <p style="margin:4px 0 0;font-size:12px;font-weight:600;color:#0f172a;font-family:'Courier New',monospace;">${requestId}</p>
                  </td>
                  <td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;border-left:1px solid #f1f5f9;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Assigned Clinic</p>
                    <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#0f172a;">🏥 ${clinicName}</p>
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding:14px 16px;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Service</p>
                    <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#0f172a;">🩺 ${serviceName}</p>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                <tr>
                  <td style="background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px 16px;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="font-size:16px;padding-right:10px;vertical-align:top;">👉</td>
                        <td style="font-size:13px;color:#1e40af;line-height:1.6;">
                          <strong>Next step:</strong> Log in to the app and add your drivers to this request so the clinic can begin processing them.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <div style="height:1px;background-color:#e2e8f0;"></div>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 36px;text-align:center;">
              <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#475569;">MediCheck Team</p>
              <p style="margin:0;font-size:12px;color:#94a3b8;">This is an automated message. Please do not reply.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

export const newOrganizerRequestAdminEmail = (
  adminName: string,
  organizerName: string,
  companyName: string,
  requestId: string,
  serviceName: string,
  totalDrivers: string,
  location: string,
) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>New Organizer Request</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f8;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f6f8;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">

          <!-- Header -->
          <tr>
            <td style="background-color:#0f172a;padding:28px 36px;text-align:center;">
              <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 10px;">
                <tr>
                  <td style="background-color:#1e293b;border-radius:8px;width:36px;height:36px;text-align:center;vertical-align:middle;">
                    <span style="font-size:18px;line-height:36px;">📋</span>
                  </td>
                  <td style="padding-left:10px;vertical-align:middle;">
                    <span style="font-size:17px;font-weight:600;color:#f1f5f9;">MediCheck</span>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">New Organizer Request</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 36px;">
              <h1 style="margin:0 0 8px;font-size:20px;font-weight:600;color:#0f172a;">Hi ${adminName},</h1>
              <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.7;">
                A new organizer request has been submitted and is awaiting your review. Please assign a clinic and confirm the request.
              </p>

              <!-- Details Card -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:24px;">
                <tr>
                  <td colspan="2" style="background-color:#1e293b;padding:12px 16px;">
                    <p style="margin:0;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Request Details</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;width:40%;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Request ID</p>
                    <p style="margin:4px 0 0;font-size:12px;font-weight:600;color:#0f172a;font-family:'Courier New',monospace;">${requestId}</p>
                  </td>
                  <td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;border-left:1px solid #f1f5f9;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Status</p>
                    <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#d97706;">⏳ Pending Review</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Organizer</p>
                    <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#0f172a;">👤 ${organizerName}</p>
                  </td>
                  <td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;border-left:1px solid #f1f5f9;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Company</p>
                    <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#0f172a;">🏢 ${companyName}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Service</p>
                    <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#0f172a;">🩺 ${serviceName}</p>
                  </td>
                  <td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;border-left:1px solid #f1f5f9;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Total Drivers</p>
                    <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#0f172a;">👥 ${totalDrivers}</p>
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding:14px 16px;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Location</p>
                    <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#0f172a;">📍 ${location}</p>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                <tr>
                  <td style="background-color:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:14px 16px;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="font-size:16px;padding-right:10px;vertical-align:top;">⚡</td>
                        <td style="font-size:13px;color:#c2410c;line-height:1.6;">
                          Action required: Please log in to the admin panel, assign a clinic, and confirm this request.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <div style="height:1px;background-color:#e2e8f0;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 36px;text-align:center;">
              <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#475569;">MediCheck Platform</p>
              <p style="margin:0;font-size:12px;color:#94a3b8;">Internal admin notification. Do not reply.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

export const medicalRecordUploadedDriverEmail = (
  driverName: string,
  clinicName: string,
  recordId: string,
  result: string,
  expiryDate?: string,
) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Medical Record Uploaded</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f8;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f6f8;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">

          <!-- Header -->
          <tr>
            <td style="background-color:#0f6e56;padding:36px;text-align:center;">
              <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 16px;">
                <tr>
                  <td style="background-color:#1d9e75;border-radius:50%;width:56px;height:56px;text-align:center;vertical-align:middle;">
                    <span style="font-size:26px;line-height:56px;">📋</span>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 4px;font-size:20px;font-weight:700;color:#ffffff;">Medical Record Uploaded</p>
              <p style="margin:0;font-size:13px;color:#9fe1cb;">Your report is now available</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 36px;">
              <h1 style="margin:0 0 8px;font-size:18px;font-weight:600;color:#0f172a;">Hi ${driverName},</h1>
              <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.7;">
                Your medical record has been uploaded by <strong>${clinicName}</strong>. You can view your report in the app.
              </p>

              <!-- Record Card -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:24px;">
                <tr>
                  <td colspan="2" style="background-color:#0f6e56;padding:12px 16px;">
                    <p style="margin:0;font-size:11px;font-weight:700;color:#d1fae5;text-transform:uppercase;letter-spacing:1px;">Record Summary</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;width:40%;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Record ID</p>
                    <p style="margin:4px 0 0;font-size:12px;font-weight:600;color:#0f172a;font-family:'Courier New',monospace;">${recordId}</p>
                  </td>
                  <td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;border-left:1px solid #f1f5f9;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Result</p>
                    <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#0f6e56;">${result}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 16px;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Uploaded By</p>
                    <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#0f172a;">🏥 ${clinicName}</p>
                  </td>
                  <td style="padding:14px 16px;border-left:1px solid #f1f5f9;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Expiry Date</p>
                    <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#0f172a;">${expiryDate ?? 'N/A'}</p>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                <tr>
                  <td style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 16px;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="font-size:16px;padding-right:10px;vertical-align:top;padding-top:1px;">📌</td>
                        <td style="font-size:13px;color:#166534;line-height:1.6;">
                          Log in to the app to view and download your full medical report.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <div style="height:1px;background-color:#e2e8f0;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 36px;text-align:center;">
              <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#475569;">MediCheck Team</p>
              <p style="margin:0;font-size:12px;color:#94a3b8;">This is an automated message. Please do not reply.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

export const medicalRecordUploadedOrganizerEmail = (
  organizerName: string,
  driverName: string,
  clinicName: string,
  recordId: string,
  result: string,
  expiryDate?: string,
) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Driver Medical Record Uploaded</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f8;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f6f8;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">

          <!-- Header -->
          <tr>
            <td style="background-color:#0f172a;padding:28px 36px;text-align:center;">
              <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 10px;">
                <tr>
                  <td style="background-color:#1e293b;border-radius:8px;width:36px;height:36px;text-align:center;vertical-align:middle;">
                    <span style="font-size:18px;line-height:36px;">📋</span>
                  </td>
                  <td style="padding-left:10px;vertical-align:middle;">
                    <span style="font-size:17px;font-weight:600;color:#f1f5f9;">MediCheck</span>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Driver Record Alert</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 36px;">
              <h1 style="margin:0 0 8px;font-size:18px;font-weight:600;color:#0f172a;">Hi ${organizerName},</h1>
              <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.7;">
                A medical record has been uploaded for one of your drivers by <strong>${clinicName}</strong>.
              </p>

              <!-- Record Card -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:24px;">
                <tr>
                  <td colspan="2" style="background-color:#1e293b;padding:12px 16px;">
                    <p style="margin:0;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Record Details</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;width:40%;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Record ID</p>
                    <p style="margin:4px 0 0;font-size:12px;font-weight:600;color:#0f172a;font-family:'Courier New',monospace;">${recordId}</p>
                  </td>
                  <td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;border-left:1px solid #f1f5f9;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Result</p>
                    <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#0f6e56;">${result}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 16px;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Driver</p>
                    <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#0f172a;">👤 ${driverName}</p>
                  </td>
                  <td style="padding:14px 16px;border-left:1px solid #f1f5f9;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Expiry Date</p>
                    <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#0f172a;">${expiryDate ?? 'N/A'}</p>
                  </td>
                </tr>
              </table>

              <div style="height:1px;background-color:#e2e8f0;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 36px;text-align:center;">
              <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#475569;">MediCheck Platform</p>
              <p style="margin:0;font-size:12px;color:#94a3b8;">Internal notification. Do not reply.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

export const paymentSuccessDriverEmail = (
  driverName: string,
  bookingId: string,
  bookingDate: string,
  clinicName: string,
  amount: number,
  paymentMethod: string,
) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Payment Successful</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f8;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f6f8;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">

          <!-- Header -->
          <tr>
            <td style="background-color:#0f6e56;padding:36px 36px;text-align:center;">
              <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 16px;">
                <tr>
                  <td style="background-color:#1d9e75;border-radius:50%;width:56px;height:56px;text-align:center;vertical-align:middle;">
                    <span style="font-size:26px;line-height:56px;">✅</span>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 4px;font-size:20px;font-weight:700;color:#ffffff;">Payment Successful</p>
              <p style="margin:0;font-size:13px;color:#9fe1cb;">Your booking is now confirmed</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 36px;">

              <h1 style="margin:0 0 8px;font-size:18px;font-weight:600;color:#0f172a;">Hi ${driverName},</h1>
              <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.7;">
                Your payment has been received and your appointment is now confirmed. Here's a summary of your booking.
              </p>

              <!-- Receipt Card -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:24px;">

                <tr>
                  <td colspan="2" style="background-color:#0f6e56;padding:12px 16px;">
                    <p style="margin:0;font-size:11px;font-weight:700;color:#d1fae5;text-transform:uppercase;letter-spacing:1px;">Payment Receipt</p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;width:40%;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Booking ID</p>
                    <p style="margin:4px 0 0;font-size:12px;font-weight:600;color:#0f172a;font-family:'Courier New',monospace;">${bookingId}</p>
                  </td>
                  <td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;border-left:1px solid #f1f5f9;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Status</p>
                    <p style="margin:4px 0 0;font-size:13px;font-weight:700;color:#0f6e56;">✅ Confirmed</p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Clinic</p>
                    <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#0f172a;">🏥 ${clinicName}</p>
                  </td>
                  <td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;border-left:1px solid #f1f5f9;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Appointment Date</p>
                    <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#0f172a;">📅 ${bookingDate}</p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:14px 16px;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Amount Paid</p>
                    <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#0f172a;">$${amount.toFixed(2)} <span style="font-size:12px;font-weight:400;color:#94a3b8;">USD</span></p>
                  </td>
                  <td style="padding:14px 16px;border-left:1px solid #f1f5f9;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Payment Method</p>
                    <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#0f172a;">${paymentMethod === 'Stripe' ? '💳' : '🅿️'} ${paymentMethod}</p>
                  </td>
                </tr>

              </table>

              <!-- Reminder -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                <tr>
                  <td style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 16px;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="font-size:16px;padding-right:10px;vertical-align:top;padding-top:1px;">📌</td>
                        <td style="font-size:13px;color:#166534;line-height:1.6;">
                          Please arrive on time for your appointment. Bring this confirmation email or your booking ID if needed.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <div style="height:1px;background-color:#e2e8f0;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 36px;text-align:center;">
              <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#475569;">MediCheck Team</p>
              <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">This is an automated message. Please do not reply.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;

export const paymentSuccessAdminEmail = (
  adminName: string,
  driverName: string,
  clinicName: string,
  bookingId: string,
  bookingDate: string,
  amount: number,
  paymentMethod: string,
) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Payment Received – Admin Alert</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f8;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f6f8;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">

          <!-- Header -->
          <tr>
            <td style="background-color:#0f172a;padding:28px 36px;text-align:center;">
              <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 10px;">
                <tr>
                  <td style="background-color:#1e293b;border-radius:8px;width:36px;height:36px;text-align:center;vertical-align:middle;">
                    <span style="font-size:18px;line-height:36px;">💰</span>
                  </td>
                  <td style="padding-left:10px;vertical-align:middle;">
                    <span style="font-size:17px;font-weight:600;color:#f1f5f9;">MediCheck</span>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Payment Received</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 36px;">

              <h1 style="margin:0 0 8px;font-size:20px;font-weight:600;color:#0f172a;">Hi ${adminName},</h1>
              <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.7;">
                A payment has been successfully received and the booking is now confirmed.
              </p>

              <!-- Details Card -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:24px;">

                <tr>
                  <td colspan="2" style="background-color:#1e293b;padding:12px 16px;">
                    <p style="margin:0;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Transaction Summary</p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;width:40%;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Booking ID</p>
                    <p style="margin:4px 0 0;font-size:12px;font-weight:600;color:#0f172a;font-family:'Courier New',monospace;">${bookingId}</p>
                  </td>
                  <td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;border-left:1px solid #f1f5f9;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Status</p>
                    <p style="margin:4px 0 0;font-size:13px;font-weight:700;color:#0f6e56;">✅ Payment Confirmed</p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Driver</p>
                    <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#0f172a;">👤 ${driverName}</p>
                  </td>
                  <td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;border-left:1px solid #f1f5f9;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Clinic</p>
                    <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#0f172a;">🏥 ${clinicName}</p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:14px 16px;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Amount</p>
                    <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#0f172a;">$${amount.toFixed(2)} <span style="font-size:12px;font-weight:400;color:#94a3b8;">USD</span></p>
                  </td>
                  <td style="padding:14px 16px;border-left:1px solid #f1f5f9;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Method</p>
                    <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#0f172a;">${paymentMethod === 'Stripe' ? '💳' : '🅿️'} ${paymentMethod}</p>
                  </td>
                </tr>

              </table>

              <div style="height:1px;background-color:#e2e8f0;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 36px;text-align:center;">
              <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#475569;">MediCheck Platform</p>
              <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">Internal admin notification. Do not reply.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;

export const bookingCreatedDriverEmail = (
  driverName: string,
  clinicName: string,
  bookingId: string,
  bookingDate: string,
  timeSlot: string,
) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Booking Created</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f8;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f6f8;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">

          <!-- Header -->
          <tr>
            <td style="background-color:#0f172a;padding:28px 36px;text-align:center;">
              <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 10px;">
                <tr>
                  <td style="background-color:#1e293b;border-radius:8px;width:36px;height:36px;text-align:center;vertical-align:middle;">
                    <span style="font-size:18px;line-height:36px;">🏥</span>
                  </td>
                  <td style="padding-left:10px;vertical-align:middle;">
                    <span style="font-size:17px;font-weight:600;color:#f1f5f9;">MediCheck</span>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Appointment Booked</p>
            </td>
          </tr>

          <!-- Status Badge -->
          <tr>
            <td style="background-color:#fefce8;border-bottom:1px solid #fde047;padding:14px 36px;text-align:center;">
              <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
                <tr>
                  <td style="font-size:14px;padding-right:8px;">⏳</td>
                  <td style="font-size:13px;color:#854d0e;font-weight:600;">Awaiting Payment – Please complete to confirm your booking</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 36px;">

              <h1 style="margin:0 0 8px;font-size:20px;font-weight:600;color:#0f172a;">Hi ${driverName},</h1>
              <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.7;">
                Your appointment has been created successfully. Complete the payment below to secure your slot.
              </p>

              <!-- Booking Details Card -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:24px;">

                <tr>
                  <td colspan="2" style="background-color:#0f6e56;padding:12px 16px;">
                    <p style="margin:0;font-size:11px;font-weight:700;color:#d1fae5;text-transform:uppercase;letter-spacing:1px;">Booking Summary</p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;width:40%;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Booking ID</p>
                    <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#0f172a;font-family:'Courier New',monospace;">${bookingId}</p>
                  </td>
                  <td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;border-left:1px solid #f1f5f9;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Status</p>
                    <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#d97706;">⏳ Pending Payment</p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Clinic</p>
                    <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#0f172a;">🏥 ${clinicName}</p>
                  </td>
                  <td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;border-left:1px solid #f1f5f9;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Date</p>
                    <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#0f172a;">📅 ${bookingDate}</p>
                  </td>
                </tr>

                <tr>
                  <td colspan="2" style="padding:14px 16px;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Time Slot</p>
                    <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#0f172a;">🕐 ${timeSlot}</p>
                  </td>
                </tr>

              </table>

              <!-- CTA Note -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                <tr>
                  <td style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 16px;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="font-size:16px;padding-right:10px;vertical-align:top;padding-top:1px;">💡</td>
                        <td style="font-size:13px;color:#166534;line-height:1.6;">
                          Head back to the app and complete your payment to confirm this appointment. Your slot will be reserved once payment is received.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <div style="height:1px;background-color:#e2e8f0;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 36px;text-align:center;">
              <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#475569;">MediCheck Team</p>
              <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">This is an automated message. Please do not reply.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;

export const bookingCreatedClinicEmail = (
  clinicName: string,
  bookingId: string,
  bookingDate: string,
  timeSlot: string,
) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>New Booking Received</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f8;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f6f8;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">

          <!-- Header -->
          <tr>
            <td style="background-color:#0f6e56;padding:28px 36px;text-align:center;">
              <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 10px;">
                <tr>
                  <td style="background-color:#1d9e75;border-radius:8px;width:36px;height:36px;text-align:center;vertical-align:middle;">
                    <span style="font-size:18px;line-height:36px;">🏥</span>
                  </td>
                  <td style="padding-left:10px;vertical-align:middle;">
                    <span style="font-size:17px;font-weight:600;color:#e1f5ee;">MediCheck</span>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:12px;color:#9fe1cb;text-transform:uppercase;letter-spacing:1px;">New Booking Received</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 36px;">

              <h1 style="margin:0 0 8px;font-size:20px;font-weight:600;color:#0f172a;">Hi ${clinicName},</h1>
              <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.7;">
                A driver has booked an appointment at your clinic. Payment is pending — the booking will be confirmed once payment is received.
              </p>

              <!-- Booking Details Card -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:24px;">

                <tr>
                  <td colspan="2" style="background-color:#0f172a;padding:12px 16px;">
                    <p style="margin:0;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Appointment Details</p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;width:40%;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Booking ID</p>
                    <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#0f172a;font-family:'Courier New',monospace;">${bookingId}</p>
                  </td>
                  <td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;border-left:1px solid #f1f5f9;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Payment Status</p>
                    <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#d97706;">⏳ Pending</p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Date</p>
                    <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#0f172a;">📅 ${bookingDate}</p>
                  </td>
                  <td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;border-left:1px solid #f1f5f9;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Time Slot</p>
                    <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#0f172a;">🕐 ${timeSlot}</p>
                  </td>
                </tr>

              </table>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                <tr>
                  <td style="background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px 16px;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="font-size:16px;padding-right:10px;vertical-align:top;padding-top:1px;">ℹ️</td>
                        <td style="font-size:13px;color:#1e40af;line-height:1.6;">
                          You will receive a confirmation email once the driver completes their payment.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <div style="height:1px;background-color:#e2e8f0;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 36px;text-align:center;">
              <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#475569;">MediCheck Team</p>
              <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">This is an automated message. Please do not reply.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;

export const bookingCreatedAdminEmail = (
  adminName: string,
  driverName: string,
  clinicName: string,
  bookingId: string,
  bookingDate: string,
) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>New Booking – Admin Alert</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f8;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f6f8;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">

          <!-- Header -->
          <tr>
            <td style="background-color:#0f172a;padding:28px 36px;text-align:center;">
              <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 10px;">
                <tr>
                  <td style="background-color:#1e293b;border-radius:8px;width:36px;height:36px;text-align:center;vertical-align:middle;">
                    <span style="font-size:18px;line-height:36px;">🏥</span>
                  </td>
                  <td style="padding-left:10px;vertical-align:middle;">
                    <span style="font-size:17px;font-weight:600;color:#f1f5f9;">MediCheck</span>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Admin Notification</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 36px;">

              <h1 style="margin:0 0 8px;font-size:20px;font-weight:600;color:#0f172a;">Hi ${adminName},</h1>
              <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.7;">
                A new booking has been created on the platform. Payment is pending confirmation.
              </p>

              <!-- Details Card -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:24px;">

                <tr>
                  <td colspan="2" style="background-color:#1e293b;padding:12px 16px;">
                    <p style="margin:0;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Booking Details</p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;width:40%;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Booking ID</p>
                    <p style="margin:4px 0 0;font-size:12px;font-weight:600;color:#0f172a;font-family:'Courier New',monospace;">${bookingId}</p>
                  </td>
                  <td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;border-left:1px solid #f1f5f9;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Date</p>
                    <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#0f172a;">📅 ${bookingDate}</p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Driver</p>
                    <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#0f172a;">👤 ${driverName}</p>
                  </td>
                  <td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;border-left:1px solid #f1f5f9;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Clinic</p>
                    <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#0f172a;">🏥 ${clinicName}</p>
                  </td>
                </tr>

                <tr>
                  <td colspan="2" style="padding:14px 16px;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Payment Status</p>
                    <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#d97706;">⏳ Pending – Awaiting driver payment</p>
                  </td>
                </tr>

              </table>

              <div style="height:1px;background-color:#e2e8f0;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 36px;text-align:center;">
              <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#475569;">MediCheck Platform</p>
              <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">Internal admin notification. Do not reply.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;

// ============================================================
// TICKET EMAIL TEMPLATES
// ============================================================

export const ticketCreatedUserEmail = (
  userName: string,
  ticketNumber: string,
  subject: string,
) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Support Ticket Created</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f8;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f6f8;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">

          <!-- Header -->
          <tr>
            <td style="background-color:#0f6e56;padding:28px 36px;text-align:center;">
              <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 10px;">
                <tr>
                  <td style="background-color:#1d9e75;border-radius:8px;width:36px;height:36px;text-align:center;vertical-align:middle;">
                    <span style="font-size:18px;line-height:36px;">🎫</span>
                  </td>
                  <td style="padding-left:10px;vertical-align:middle;">
                    <span style="font-size:17px;font-weight:600;color:#e1f5ee;">MediCheck</span>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:12px;color:#9fe1cb;text-transform:uppercase;letter-spacing:1px;">Support Ticket Created</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 36px;">

              <h1 style="margin:0 0 8px;font-size:20px;font-weight:600;color:#0f172a;">Hi ${userName},</h1>
              <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.7;">
                Your support ticket has been created successfully. Our team will review it shortly and get back to you.
              </p>

              <!-- Ticket Details Card -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:24px;">

                <tr>
                  <td colspan="2" style="background-color:#0f6e56;padding:12px 16px;">
                    <p style="margin:0;font-size:11px;font-weight:700;color:#d1fae5;text-transform:uppercase;letter-spacing:1px;">Ticket Details</p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;width:40%;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Ticket Number</p>
                    <p style="margin:4px 0 0;font-size:14px;font-weight:700;color:#0f172a;font-family:'Courier New',monospace;">${ticketNumber}</p>
                  </td>
                  <td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;border-left:1px solid #f1f5f9;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Status</p>
                    <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#d97706;">⏳ Open</p>
                  </td>
                </tr>

                <tr>
                  <td colspan="2" style="padding:14px 16px;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Subject</p>
                    <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#0f172a;">${subject}</p>
                  </td>
                </tr>

              </table>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                <tr>
                  <td style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 16px;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="font-size:16px;padding-right:10px;vertical-align:top;padding-top:1px;">💡</td>
                        <td style="font-size:13px;color:#166534;line-height:1.6;">
                          You can track the status of your ticket and reply to it from the app. We'll notify you when there's an update.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <div style="height:1px;background-color:#e2e8f0;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 36px;text-align:center;">
              <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#475569;">MediCheck Support Team</p>
              <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">This is an automated message. Please do not reply to this email.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;

export const ticketCreatedAdminEmail = (
  adminName: string,
  userName: string,
  ticketNumber: string,
  subject: string,
) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>New Support Ticket – Admin Alert</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f8;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f6f8;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">

          <!-- Header -->
          <tr>
            <td style="background-color:#0f172a;padding:28px 36px;text-align:center;">
              <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 10px;">
                <tr>
                  <td style="background-color:#1e293b;border-radius:8px;width:36px;height:36px;text-align:center;vertical-align:middle;">
                    <span style="font-size:18px;line-height:36px;">🎫</span>
                  </td>
                  <td style="padding-left:10px;vertical-align:middle;">
                    <span style="font-size:17px;font-weight:600;color:#f1f5f9;">MediCheck</span>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">New Support Ticket</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 36px;">

              <h1 style="margin:0 0 8px;font-size:20px;font-weight:600;color:#0f172a;">Hi ${adminName},</h1>
              <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.7;">
                A new support ticket has been submitted by a user and is awaiting your attention.
              </p>

              <!-- Details Card -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:24px;">

                <tr>
                  <td colspan="2" style="background-color:#1e293b;padding:12px 16px;">
                    <p style="margin:0;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Ticket Details</p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;width:40%;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Ticket Number</p>
                    <p style="margin:4px 0 0;font-size:14px;font-weight:700;color:#0f172a;font-family:'Courier New',monospace;">${ticketNumber}</p>
                  </td>
                  <td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;border-left:1px solid #f1f5f9;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Status</p>
                    <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#d97706;">⏳ Open</p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Submitted By</p>
                    <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#0f172a;">👤 ${userName}</p>
                  </td>
                  <td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;border-left:1px solid #f1f5f9;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Subject</p>
                    <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#0f172a;">${subject}</p>
                  </td>
                </tr>

              </table>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                <tr>
                  <td style="background-color:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:14px 16px;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="font-size:16px;padding-right:10px;vertical-align:top;">⚡</td>
                        <td style="font-size:13px;color:#c2410c;line-height:1.6;">
                          Action required: Log in to the admin panel to review and assign this ticket.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <div style="height:1px;background-color:#e2e8f0;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 36px;text-align:center;">
              <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#475569;">MediCheck Platform</p>
              <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">Internal admin notification. Do not reply.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;

const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 2525,
  secure: false,
  auth: {
    user: '9c2e26001@smtp-brevo.com',
    pass: 'xsmtpsib-6f4ae0a7edf1a4060397ddb2c08fbc2c4cc490b65a0426eda617acdd79231b65-7NzFcx8E4bluIFfc',
  },
});

const emailSender = async (
  to: string,
  html: string,
  subject: string,
): Promise<string> => {
  try {
    const info = await transporter.sendMail({
      from: `"MediCheck Platform" <noreply@multitenant.com>`,
      to,
      subject,
      html,
    });

    console.log('Email sent:', info.messageId);

    return info.messageId;
  } catch (error) {
    console.error('Email sending failed:', error);
    throw new Error('Failed to send email.');
  }
};

export default emailSender;
