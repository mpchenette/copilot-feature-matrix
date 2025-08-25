use std::fs;
use std::io::prelude::*;
use std::net::{TcpListener, TcpStream};
use std::path::Path;

fn main() {
    let listener = TcpListener::bind("0.0.0.0:8000").unwrap();
    println!("🦀 Rust server running on http://localhost:8000");

    for stream in listener.incoming() {
        match stream {
            Ok(stream) => {
                handle_connection(stream);
            }
            Err(e) => {
                eprintln!("Error: {}", e);
            }
        }
    }
}

fn handle_connection(mut stream: TcpStream) {
    let mut buffer = [0; 1024];
    let _ = stream.read(&mut buffer);

    let request = String::from_utf8_lossy(&buffer);
    let request_line = request.lines().next().unwrap_or("");
    
    // Parse the request path
    let path = if let Some(path_part) = request_line.split_whitespace().nth(1) {
        if path_part == "/" {
            "/index.html"
        } else {
            path_part
        }
    } else {
        "/index.html"
    };

    // Remove leading slash and serve file
    let file_path = &path[1..];
    serve_file(&mut stream, file_path);
}

fn serve_file(stream: &mut TcpStream, file_path: &str) {
    // Prepend "static/" to the file path
    let full_path = format!("static/{}", file_path);
    
    let (status_line, contents) = if Path::new(&full_path).exists() {
        let contents = fs::read_to_string(&full_path).unwrap_or_default();
        ("HTTP/1.1 200 OK", contents)
    } else {
        ("HTTP/1.1 404 NOT FOUND", format!("404 - File not found: {}", file_path))
    };

    // Determine content type
    let content_type = match file_path.split('.').last() {
        Some("html") => "text/html",
        Some("css") => "text/css",
        Some("js") => "application/javascript",
        Some("json") => "application/json",
        Some("svg") => "image/svg+xml",
        _ => "text/plain",
    };

    let response = format!(
        "{}\r\nContent-Type: {}\r\nContent-Length: {}\r\n\r\n{}",
        status_line,
        content_type,
        contents.len(),
        contents
    );

    let _ = stream.write(response.as_bytes());
    let _ = stream.flush();
}
