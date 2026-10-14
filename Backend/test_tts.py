import asyncio

import edge_tts


async def main():
    text = "Hello! Welcome to Voice X AI."
    voice = "en-US-AriaNeural"
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save("voice_test.mp3")
    print("Audio generated: voice_test.mp3")


if __name__ == "__main__":
    asyncio.run(main())
