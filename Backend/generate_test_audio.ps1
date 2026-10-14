Add-Type -AssemblyName System.Speech
$speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
$speaker.SetOutputToWaveFile("voice-test.wav")
$speaker.Speak("Hello, this is a test of VoiceX AI.")
$speaker.Dispose()
Write-Host "Audio generated successfully: voice-test.wav"
