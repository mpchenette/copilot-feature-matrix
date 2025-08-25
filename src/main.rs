use std::env;
use std::fs;
use std::io::prelude::*;
use std::net::{TcpListener, TcpStream};
use std::path::Path;

fn main() {
    // Get port from environment variable (Azure sets WEBSITES_PORT)
    let port = env::var("WEBSITES_PORT")
        .or_else(|_| env::var("PORT"))
        .unwrap_or_else(|_| "8000".to_string());
    
    let bind_address = format!("0.0.0.0:{}", port);
    let listener = TcpListener::bind(&bind_address).unwrap();
    
    println!("🦀 Rust server running on {}", bind_address);
    println!("📁 Current directory: {:?}", env::current_dir().unwrap());
    
    // Check if static files exist
    if Path::new("static").exists() {
        println!("✅ static/ directory found");
        if let Ok(entries) = fs::read_dir("static") {
            for entry in entries {
                if let Ok(entry) = entry {
                    println!("📄 Found file: {:?}", entry.file_name());
                }
            }
        }
    } else {
        println!("❌ static/ directory NOT found");
    }

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
    
    println!("📥 Request: {}", request_line);
    
    // Parse the request path
    let path = if let Some(path_part) = request_line.split_whitespace().nth(1) {
        // Remove query parameters (everything after ?)
        let clean_path = path_part.split('?').next().unwrap_or(path_part);
        if clean_path == "/" {
            "/index.html"
        } else {
            clean_path
        }
    } else {
        "/index.html"
    };

    println!("📂 Serving path: {}", path);
    
    // Remove leading slash and serve file
    let file_path = &path[1..];
    serve_file(&mut stream, file_path);
}

fn serve_file(stream: &mut TcpStream, file_path: &str) {
    // Try multiple possible locations for files
    let possible_paths = vec![
        format!("static/{}", file_path),  // Local development
        format!("./{}", file_path),       // Root directory
        file_path.to_string(),            // Exact path
    ];
    
    let mut contents = String::new();
    let mut found = false;
    
    for path in possible_paths {
        println!("🔍 Trying path: {}", path);
        if Path::new(&path).exists() {
            println!("✅ File found at: {}", path);
            contents = fs::read_to_string(&path).unwrap_or_default();
            found = true;
            break;
        }
    }
    
    let (status_line, final_contents) = if found {
        ("HTTP/1.1 200 OK", contents)
    } else {
        println!("❌ File not found anywhere: {}", file_path);
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
        final_contents.len(),
        final_contents
    );

    let _ = stream.write(response.as_bytes());
    let _ = stream.flush();
}
