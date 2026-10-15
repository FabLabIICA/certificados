// REEMPLAZA CON LA URL DE TU API DE RENDER O RAILWAY
const API_URL = "https://generador-certificados-api.onrender.com";

// URL TSV exacta de tu Google Sheets
const SHEET_TSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQifnfKxYpgja_qKt6TGJ2xrOfGWAaxVoSF3JvoFMBowmAHV1I5HCtSzaGjVw8Bh47mm2h5ShmYXZn8/pub?gid=0&single=true&output=tsv";

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

function convertirLinkDriveAImagen(url) {
    if (!url || url.trim() === "") return "https://via.placeholder.com/400x200?text=Machote";
    const cleanUrl = url.trim();
    const match = cleanUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || cleanUrl.match(/id=([a-zA-Z0-9_-]+)/);
    if (!match) return cleanUrl;
    return `https://lh3.googleusercontent.com/d/${match[1]}`;
}

async function cargarCatalogo() {
    const wrapper = document.getElementById("catalogoWrapper");
    if (!wrapper) return;

    try {
        const response = await fetch(SHEET_TSV_URL);
        if (!response.ok) throw new Error("No se pudo conectar con Google Sheets.");

        const tsvTexto = await response.text();
        const filas = tsvTexto.split(/\r?\n/).filter(f => f.trim() !== "");

        if (filas.length <= 1) {
            wrapper.innerHTML = `<div class="loading-state">No hay certificados registrados en la hoja de cálculo.</div>`;
            return;
        }

        // Mapeo columnas: col[0]=Nombre, col[1]=Descripción, col[2]=Enlace Machote, col[3]=Imagen
        const cardsHtml = filas.slice(1).map(row => {
            const col = parsearLineaTSV(row);
            const nombre = col[0] || "Certificado";
            const descripcion = col[1] || "Sin descripción.";
            const enlaceMachote = col[2] || "#";
            const imagenMachote = convertirLinkDriveAImagen(col[3]);

            return `
                <div class="certificate-card">
                    <div class="card-image">
                        <img src="${imagenMachote}" alt="${nombre}" onerror="this.src='https://via.placeholder.com/400x200?text=Machote'">
                    </div>
                    <div class="card-body">
                        <h3>${nombre}</h3>
                        <p>${descripcion}</p>
                        <div class="card-actions">
                            <div class="action-row">
                                <a href="${enlaceMachote}" target="_blank" rel="noopener noreferrer" class="btn-sm btn-view">Ver Machote</a>
                                <button onclick="descargarPlantillaDatos('${enlaceMachote}', '${nombre}')" class="btn-sm btn-template">Descargar Plantilla</button>
                            </div>
                            <button onclick="abrirModalGenerar('${enlaceMachote}', '${nombre}')" class="btn-sm btn-generate">Subir Datos y Generar</button>
                        </div>
                    </div>
                </div>
            `;
        }).join("");

        wrapper.innerHTML = cardsHtml;

    } catch (error) {
        console.error(error);
        wrapper.innerHTML = `<div class="loading-state">Error al cargar el catálogo desde Google Sheets.</div>`;
    }
}

// 1. Descargar plantilla personalizada leyendo el Word desde el backend
async function descargarPlantillaDatos(urlMachote, nombreCurso) {
    if (!urlMachote || urlMachote === "#") {
        alert("El enlace del machote no es válido.");
        return;
    }

    alert("Analizando machote y generando plantilla personalizada...");

    try {
        const response = await fetch(`${API_URL}/api/plantilla-datos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: urlMachote })
        });

        if (!response.ok) throw new Error("Error al procesar el machote en el servidor.");

        const blob = await response.blob();
        const link = document.createElement("a");
        link.href = window.URL.createObjectURL(blob);
        link.download = `plantilla_${nombreCurso.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
        document.body.appendChild(link);
        link.click();
        link.remove();
    } catch (err) {
        console.error(err);
        alert("Ocurrió un error al generar la plantilla de datos.");
    }
}

// 2. Control de Modal para Generación
function abrirModalGenerar(urlMachote, nombreCurso) {
    document.getElementById("selectedUrlMachote").value = urlMachote;
    document.getElementById("modalTitulo").innerText = `Generar: ${nombreCurso}`;
    document.getElementById("modalDescripcion").innerText = "Sube tu archivo completado para este certificado y obtén el archivo ZIP de inmediato.";
    document.getElementById("archivoDatos").value = "";
    document.getElementById("modalGenerar").classList.remove("hidden");
}

function cerrarModal() {
    document.getElementById("modalGenerar").classList.add("hidden");
}

// 3. Enviar datos y machote seleccionado al backend
async function enviarLote(event) {
    event.preventDefault();

    const urlMachote = document.getElementById("selectedUrlMachote").value;
    const archivoDatos = document.getElementById("archivoDatos").files[0];
    const btn = document.getElementById("btnGenerarLote");
    const loading = document.getElementById("modalLoading");

    if (!archivoDatos) {
        alert("Por favor selecciona un archivo de datos.");
        return;
    }

    const formData = new FormData();
    formData.append("url_machote", urlMachote);
    formData.append("archivo_datos", archivoDatos);

    btn.disabled = true;
    loading.classList.remove("hidden");

    try {
        const response = await fetch(`${API_URL}/api/generar-certificados`, {
            method: "POST",
            body: formData
        });

        if (!response.ok) throw new Error("Error al generar los certificados.");

        const blob = await response.blob();
        const link = document.createElement("a");
        link.href = window.URL.createObjectURL(blob);
        link.download = "certificados_generados.zip";
        document.body.appendChild(link);
        link.click();
        link.remove();

        cerrarModal();
        alert("¡Certificados generados y descargados con éxito!");

    } catch (error) {
        console.error(error);
        alert("Hubo un error al procesar el lote en el servidor.");
    } finally {
        btn.disabled = false;
        loading.classList.add("hidden");
    }
}

document.addEventListener("DOMContentLoaded", () => {
    cargarCatalogo();
});
