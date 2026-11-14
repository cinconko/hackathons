// Read text from an image with Apple's Vision framework (offline, on-device).
// Usage: ocr <image-path>
// Prints JSON: {"text": "...", "lines": [{"text": "...", "confidence": 0.98}], "confidence": 0.97}
// Exit code 2 = bad input, 3 = recognition failed.

import Foundation
import Vision
import ImageIO

func fail(_ code: Int32, _ message: String) -> Never {
    FileHandle.standardError.write((message + "\n").data(using: .utf8)!)
    exit(code)
}

guard CommandLine.arguments.count == 2 else { fail(2, "usage: ocr <image-path>") }
let url = URL(fileURLWithPath: CommandLine.arguments[1])

guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
      let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
    fail(2, "not a readable image: \(url.path)")
}

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.recognitionLanguages = ["cs-CZ", "en-US"] // Czech first: most demo scams are Czech
request.usesLanguageCorrection = true

do {
    try VNImageRequestHandler(cgImage: image, options: [:]).perform([request])
} catch {
    fail(3, "recognition failed: \(error.localizedDescription)")
}

// Vision returns lines top-to-bottom in reading order for typical screenshots.
var lines: [[String: Any]] = []
for obs in request.results ?? [] {
    guard let best = obs.topCandidates(1).first else { continue }
    lines.append(["text": best.string, "confidence": Double(best.confidence)])
}
let texts = lines.compactMap { $0["text"] as? String }
let avg = lines.isEmpty ? 0.0 : lines.compactMap { $0["confidence"] as? Double }.reduce(0, +) / Double(lines.count)
let out: [String: Any] = ["text": texts.joined(separator: "\n"), "lines": lines, "confidence": avg]
let data = try JSONSerialization.data(withJSONObject: out, options: [])
FileHandle.standardOutput.write(data)
