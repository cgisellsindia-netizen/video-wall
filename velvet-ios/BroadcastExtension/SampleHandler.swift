import ReplayKit
import Vision
import CoreImage
import Foundation

final class SampleHandler: RPBroadcastSampleHandler {
    private var working = false
    private var previousRecognition = Date.distantPast

    override func broadcastStarted(withSetupInfo setupInfo: [String: NSObject]?) {
        VelvetShared.storeVisibleText("")
    }
    override func broadcastFinished() {
        VelvetShared.storeVisibleText("")
    }
    override func processSampleBuffer(_ sampleBuffer: CMSampleBuffer, with sampleBufferType: RPSampleBufferType) {
        guard sampleBufferType == .video, !working,
              Date().timeIntervalSince(previousRecognition) > 2,
              let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        working = true
        previousRecognition = Date()
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = true
        do {
            try VNImageRequestHandler(cvPixelBuffer: pixelBuffer).perform([request])
            let lines = (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }
            VelvetShared.storeVisibleText(lines.joined(separator: "\n"))
        } catch {}
        working = false
    }
}
