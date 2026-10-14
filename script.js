// REEMPLAZA ESTA URL CON TU URL REAL DE RENDER O RAILWAY
const API_URL = "https://generador-certificados-api.onrender.com/generar-certificados";

// URL TSV exacta de tu Google Sheets provista
const SHEET_TSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQifnfKxYpgja_qKt6TGJ2xrOfGWAaxVoSF3JvoFMBowmAHV1I5HCtSzaGjVw8Bh47mm2h5ShmYXZn8/pub?gid=0&single=true&output=tsv";

/**
 * Parsea líneas TSV manejando comillas correctamente
 */
function parsearLineaTSV(linea) {
    const resultado = [];
    let dentroDeComillas = false;
    let entradaActual = "";

    for (let i = 0; i < linea.length; i++) {
        const char = linea[i];
        if (char === '"') {
            dentroDeComillas = !dentroDeComillas;
        } else if (char === '\t' && !dentroDeComillas) {
            resultado.push(entradaActual.trim().replace(/^"|"$/g, ''));
            entradaActual = "";
        } else {
            entradaActual += char;
        }
    }
    resultado.push(entradaActual.trim().replace(/^"|"$/g, ''));
    return resultado;
}

/**
 * Convierte enlaces de Google Drive de forma robusta para renderizar imágenes
 */
function convertirLinkDriveAImagen(url) {
    if (!url || url.trim() === "") return "assets/images/default.jpg";
    const cleanUrl = url.trim();
    const match = cleanUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || cleanUrl.match(/id=([a-zA-Z0-9_-]+)/);
    if (!match) return cleanUrl;
    return `https://lh3.googleusercontent.com/d/${match[1]}`;
}

/**
 * Carga el catálogo dinámicamente desde el TSV de Google Sheets
 */
async function cargarCatalogoDinamico() {
    const wrapper = document.getElementById("catalogoWrapper");
    if (!wrapper) return;

    try {
        const response = await fetch(SHEET_TSV_URL);
        if (!response.ok) throw new Error("Error al conectar con Google Sheets.");

        const tsvTexto = await response.text();
        const filas = tsvTexto.split(/\r?\n/).filter(f => f.trim() !== "");

        if (filas.length <= 1) {
            wrapper.innerHTML = "<p>No hay plantillas registradas en la hoja de cálculo.</p>";
            return;
        }

        // Mapeo según tus columnas:
        // col[0] = Nombre, col[1] = Descripción, col[2] = Enlace, col[3] = Imagen de Machote
        const htmlCards = filas.slice(1).map(row => {
            const col = parsearLineaTSV(row);
            const nombre = col[0] || "Certificado sin nombre";
            const descripcion = col[1] || "Sin descripción disponible.";
            const enlaceMachote = col[2] && col[2].trim() !== "" ? col[2].trim() : "#";
            const imagenMachote = convertirLinkDriveAImagen(col[3]);

            return `
                <div class="card-certificado">
                    <div class="card-img-wrap">
                        <img src="${imagenMachote}" alt="${nombre}" onerror="this.src='https://via.placeholder.com/300x160?text=Machote'">
                    </div>
                    <div class="card-body">
                        <h3>${nombre}</h3>
                        <p>${descripcion}</p>
                        <div class="card-actions">
                            <a href="${enlaceMachote}" target="_blank" rel="noopener noreferrer" class="btn-link">Ver Machote</a>
                            <button class="btn-plantilla" onclick="descargarPlantillaBase('${nombre}')">📥 Plantilla Datos</button>
                        </div>
                    </div>
                </div>
            `;
        }).join("");

        wrapper.innerHTML = htmlCards;

    } catch (error) {
        console.error("Error cargando el catálogo:", error);
        wrapper.innerHTML = "<p>Error al conectar con el catálogo de Google Sheets.</p>";
    }
}

/**
 * Genera y descarga una plantilla de ejemplo en CSV lista para completarse
 */
function descargarPlantillaBase(nombreCurso) {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "nombre,cedula,curso,fecha\n";
    csvContent += "Juan Pérez,1-1111-1111," + nombreCurso + ",Octubre 2026\n";
    csvContent += "María Gómez,2-2222-2222," + nombreCurso + ",Octubre 2026\n";

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `plantilla_datos_${nombreCurso.replace(/[^a-zA-Z0-9]/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Lógica del formulario para enviar los archivos a la API de Python y descargar el ZIP
document.getElementById("formCertificados").addEventListener("submit", async function(e) {
    e.preventDefault();

    const fileWord = document.getElementById("machoteWord").files[0];
    const fileDatos = document.getElementById("archivoDatos").files[0];
    const btnProcesar = document.getElementById("btnProcesar");
    const loading = document.getElementById("loading");

    if (!fileWord || !fileDatos) {
        alert("Por favor selecciona ambos archivos.");
        return;
    }

    const formData = new FormData();
    formData.append("plantilla", fileWord);
    formData.append("datos", fileDatos);

    btnProcesar.disabled = true;
    loading.classList.remove("hidden");

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            throw new Error("Error en el servidor al generar los certificados.");
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "certificados_generados.zip";
        document.body.appendChild(a);
        a.click();
        a.remove();

        window.URL.revokeObjectURL(url);
        alert("¡Certificados generados y descargados con éxito!");

    } catch (error) {
        console.error(error);
        alert("Hubo un error al procesar la solicitud. Revisa la consola o el estado de la API.");
    } finally {
        btnProcesar.disabled = false;
        loading.classList.add("hidden");
    }
});

// Inicializar al cargar la página
document.addEventListener("DOMContentLoaded", () => {
    cargarCatalogoDinamico();
});
