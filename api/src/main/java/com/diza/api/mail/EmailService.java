package com.diza.api.mail;

import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    private final ObjectProvider<JavaMailSender> mailSenderProvider;

    @Value("${spring.mail.username:}")
    private String mailFrom;

    public EmailService(ObjectProvider<JavaMailSender> mailSenderProvider) {
        this.mailSenderProvider = mailSenderProvider;
    }

    public void enviarCodigoRecuperacion(String destinatario, String codigo) {
        log.info("====================================================================");
        log.info("[RECUPERACIÓN DE CONTRASEÑA] Destinatario: {}, Código generado: {}", destinatario, codigo);
        log.info("====================================================================");

        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();

        if (mailSender == null || !StringUtils.hasText(mailFrom)) {
            log.warn("El servicio de correo no está configurado completamente (MAIL_USERNAME / MAIL_PASSWORD vacío). " +
                     "El código se muestra arriba en la consola para desarrollo.");
            return;
        }

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom(mailFrom, "Bodega DIZA");
            helper.setTo(destinatario);
            helper.setSubject("Bodega DIZA - Código de Recuperación de Contraseña");

            String html = """
                <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <h2 style="color: #2b3a4a; text-align: center;">Bodega DIZA</h2>
                    <hr style="border: 0; border-top: 1px solid #e0e0e0;" />
                    <p style="font-size: 15px; color: #333;">Hola,</p>
                    <p style="font-size: 15px; color: #333;">Has solicitado restablecer tu contraseña. Utiliza el siguiente código de verificación:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; background-color: #f2f5f9; padding: 12px 24px; border-radius: 6px; color: #1e40af; border: 1px dashed #3b82f6;">
                            %s
                        </span>
                    </div>
                    <p style="font-size: 13px; color: #666;">Este código es de un solo uso y vencerá en <strong>15 minutos</strong>.</p>
                    <p style="font-size: 13px; color: #999;">Si no has solicitado este cambio, puedes ignorar este correo de forma segura.</p>
                </div>
            """.formatted(codigo);

            helper.setText(html, true);
            mailSender.send(message);
            log.info("Correo de recuperación enviado con éxito a {}", destinatario);
        } catch (Exception e) {
            log.error("Error al enviar el correo a {}: {}", destinatario, e.getMessage());
            // No bloqueamos el flujo para que el código quede disponible en logs en caso de error de red o credenciales incorrectas
        }
    }
}
