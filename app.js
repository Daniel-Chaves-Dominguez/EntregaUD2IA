import { pipeline } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js";

const MODELOS = {
    "en-es": { nombre: "Xenova/opus-mt-en-es", origen: "Inglés", destino: "Español" },
    "es-en": { nombre: "Xenova/opus-mt-es-en", origen: "Español", destino: "Inglés" },
};

const estado = document.getElementById("estado");
const progreso = document.getElementById("progreso");
const barraProgreso = document.getElementById("barraProgreso");
const etiquetaDispositivo = document.getElementById("dispositivo");
const entrada = document.getElementById("textoEntrada");
const resultado = document.getElementById("resultado");
const btnTraducir = document.getElementById("btnTraducir");
const btnCambiar = document.getElementById("btnCambiar");
const idiomaOrigen = document.getElementById("idiomaOrigen");
const idiomaDestino = document.getElementById("idiomaDestino");

let direccion = "en-es";
let dispositivo = "wasm";
const traductores = {};

function mostrarEstado(texto, tipo = "") {
    estado.textContent = texto;
    estado.className = "estado " + tipo;
}

function mostrarProgreso(porcentaje) {
    progreso.hidden = false;
    barraProgreso.style.width = porcentaje + "%";
}

function ocultarProgreso() {
    progreso.hidden = true;
    barraProgreso.style.width = "0%";
}

function activarBotones(activar) {
    btnTraducir.disabled = !activar;
    btnCambiar.disabled = !activar;
}

function actualizarIdiomas() {
    idiomaOrigen.textContent = MODELOS[direccion].origen;
    idiomaDestino.textContent = MODELOS[direccion].destino;
}

function mostrarDispositivo() {
    if (dispositivo === "webgpu") {
        etiquetaDispositivo.textContent = "Aceleración: WebGPU (GPU)";
    } else {
        etiquetaDispositivo.textContent = "Aceleración: WASM (CPU)";
    }
    etiquetaDispositivo.className = "etiqueta " + dispositivo;
}

async function detectarDispositivo() {
    if (!navigator.gpu) {
        return "wasm";
    }
    try {
        const adaptador = await navigator.gpu.requestAdapter();
        if (adaptador) {
            return "webgpu";
        }
    } catch (error) {
        console.warn("No se pudo acceder a WebGPU:", error);
    }
    return "wasm";
}

function crearPipeline(nombreModelo) {
    return pipeline("translation", nombreModelo, {
        device: dispositivo,
        dtype: dispositivo === "webgpu" ? "fp32" : "q8",
        progress_callback: (datos) => {
            if (datos.status === "progress") {
                mostrarProgreso(datos.progress);
                mostrarEstado("Cargando modelo... " + Math.round(datos.progress) + "%");
            }
        },
    });
}

async function cargarModelo() {
    if (traductores[direccion]) {
        return traductores[direccion];
    }

    const nombreModelo = MODELOS[direccion].nombre;
    mostrarEstado("Cargando modelo...");
    mostrarProgreso(0);

    try {
        traductores[direccion] = await crearPipeline(nombreModelo);
    } catch (error) {
        if (dispositivo === "webgpu") {
            console.warn("Fallo con WebGPU, se usa WASM:", error);
            dispositivo = "wasm";
            mostrarDispositivo();
            traductores[direccion] = await crearPipeline(nombreModelo);
        } else {
            throw error;
        }
    }

    ocultarProgreso();
    return traductores[direccion];
}

async function prepararModelo() {
    activarBotones(false);
    try {
        await cargarModelo();
        mostrarEstado("Modelo listo: " + MODELOS[direccion].origen + " → " + MODELOS[direccion].destino, "ok");
    } catch (error) {
        console.error(error);
        ocultarProgreso();
        mostrarEstado("Error al cargar el modelo. Recarga la página.", "error");
    }
    activarBotones(true);
}

async function traducir() {
    const texto = entrada.value.trim();
    if (texto === "") {
        mostrarEstado("Escribe un texto para traducir.", "error");
        return;
    }

    activarBotones(false);
    resultado.textContent = "";

    try {
        const traductor = await cargarModelo();
        mostrarEstado("Traduciendo...");
        const salida = await traductor(texto);
        resultado.textContent = salida[0].translation_text;
        mostrarEstado("Traducción completada.", "ok");
    } catch (error) {
        console.error(error);
        mostrarEstado("Error al traducir.", "error");
    }

    activarBotones(true);
}

async function cambiarDireccion() {
    if (direccion === "en-es") {
        direccion = "es-en";
    } else {
        direccion = "en-es";
    }
    actualizarIdiomas();
    resultado.textContent = "";
    await prepararModelo();
}

btnTraducir.addEventListener("click", traducir);
btnCambiar.addEventListener("click", cambiarDireccion);

async function iniciar() {
    actualizarIdiomas();
    dispositivo = await detectarDispositivo();
    mostrarDispositivo();
    await prepararModelo();
}

iniciar();
