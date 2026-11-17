package com.diza.api.testdata;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

/** CSV UTF-8 con comillas dobles RFC-4180 (una fila por línea). */
final class TestCsvParser {
    private TestCsvParser() {}

    static List<String[]> leer(MultipartFile file, String... campos) {
        if (file.isEmpty()) throw error("El archivo CSV está vacío");
        if (file.getSize() > 5_000_000L) throw error("CSV demasiado grande (máximo 5 MB)");
        List<String[]> resultado = new ArrayList<>();
        try (var reader = new BufferedReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            String encabezado = reader.readLine();
            if (encabezado == null) throw error("El archivo no tiene encabezado");
            if (encabezado.startsWith("\uFEFF")) encabezado = encabezado.substring(1);
            String[] columnas = separar(encabezado);
            if (!Arrays.equals(columnas, campos)) {
                throw error("Las columnas no coinciden. Esperadas: " + String.join(",", campos));
            }
            String linea;
            int numero = 1;
            while ((linea = reader.readLine()) != null) {
                numero++;
                if (linea.isBlank()) continue;
                String[] valores = separar(linea);
                if (valores.length != campos.length) {
                    throw error("Fila " + numero + ": se esperaban " + campos.length + " columnas y llegaron " + valores.length);
                }
                resultado.add(valores);
                if (resultado.size() > 20_000) throw error("Se superó el máximo de 20 000 filas");
            }
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (Exception ex) {
            throw error("No se pudo leer el archivo UTF-8: " + ex.getMessage());
        }
        if (resultado.isEmpty()) throw error("El CSV no contiene registros");
        return resultado;
    }

    private static String[] separar(String linea) {
        List<String> celdas = new ArrayList<>();
        StringBuilder celda = new StringBuilder();
        boolean entreComillas = false;
        for (int i = 0; i < linea.length(); i++) {
            char c = linea.charAt(i);
            if (c == '"') {
                if (entreComillas && i + 1 < linea.length() && linea.charAt(i + 1) == '"') {
                    celda.append('"');
                    i++;
                } else {
                    entreComillas = !entreComillas;
                }
            } else if (c == ',' && !entreComillas) {
                celdas.add(celda.toString().trim());
                celda.setLength(0);
            } else {
                celda.append(c);
            }
        }
        if (entreComillas) throw error("CSV con comillas sin cerrar; verifica el archivo");
        celdas.add(celda.toString().trim());
        return celdas.toArray(String[]::new);
    }

    static ResponseStatusException error(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
