// Pas de console en plus de la fenêtre en release sous Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    nadendar_lib::run()
}
