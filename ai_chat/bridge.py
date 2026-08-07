import os
import sys

try:
    import google.generativeai as genai
    from anthropic import Anthropic
    from dotenv import load_dotenv
except ImportError:
    print("Помилка: не знайдені потрібні бібліотеки.")
    print("Будь ласка, виконайте в терміналі команду:")
    print("pip install google-generativeai anthropic python-dotenv")
    sys.exit(1)

load_dotenv()

# Ключі доступу (зчитуються з файлу .env)
GEMINI_KEY = os.getenv("GEMINI_API_KEY")
CLAUDE_KEY = os.getenv("ANTHROPIC_API_KEY")

if not GEMINI_KEY or not CLAUDE_KEY:
    print("Увага! Для роботи потрібні API ключі обох нейромереж.")
    print("Створіть файл .env у цій директорії (або заповніть існуючий) з таким вмістом:")
    print("GEMINI_API_KEY=ваш_ключ")
    print("ANTHROPIC_API_KEY=ваш_ключ")
    sys.exit(1)

# Ініціалізація Gemini
genai.configure(api_key=GEMINI_KEY)
gemini = genai.GenerativeModel('gemini-1.5-pro-latest')
gemini_chat = gemini.start_chat(history=[])

# Ініціалізація Claude
claude = Anthropic(api_key=CLAUDE_KEY)
claude_messages = []
CLAUDE_MODEL_NAME = "claude-3-opus-20240229"

print("="*70)
print(" 🚀 Інтерактивний діалог: Gemini 1.5 Pro та Claude 3 Opus")
print("="*70)
print("Інструкція:")
print("- Напишіть своє завдання, і обидві AI почнуть його виконувати/обговорювати.")
print("- Натисніть [Enter] (пустий рядок), щоб AI відповіли одне одному (продовжили діалог).")
print("- Напишіть нове завдання, щоб направити їх в інше русло.")
print("- Напишіть 'exit', щоб вийти.")
print("="*70)

last_speaker = None
last_message = ""

while True:
    try:
        user_input = input("\n[Ви] (завдання/коментар або Enter для їхнього діалогу): ").strip()
        
        if user_input.lower() in ['exit', 'quit']:
            print("Завершення роботи...")
            break
            
        # Якщо користувач щось написав - відповідає спочатку Gemini, потім Claude
        if user_input:
            prompt_to_gemini = f"Користувач (Керівник) дає завдання або коментар: {user_input}"
            
            print("\n⏳ Gemini думає...")
            gemini_response = gemini_chat.send_message(prompt_to_gemini)
            response_text = gemini_response.text
            print(f"\n🔷 [Gemini]:\n{response_text}")
            
            # Тепер черга Claude відповісти на це
            claude_messages.append({
                "role": "user",
                "content": f"Користувач дав завдання: {user_input}\n\nТвій колега Gemini відповів наступне:\n{response_text}\n\nБудь ласка, доповни, виправ, розкритикуй або запропонуй свій варіант. Ти - Claude Opus."
            })
            
            print("\n⏳ Claude Opus думає...")
            claude_response = claude.messages.create(
                model=CLAUDE_MODEL_NAME,
                max_tokens=2048,
                messages=claude_messages
            )
            claude_text = claude_response.content[0].text
            print(f"\n🔶 [Claude Opus]:\n{claude_text}")
            
            # Зберігаємо відповідь Клода в його власну історію
            claude_messages.append({"role": "assistant", "content": claude_text})
            
            # Зберігаємо контекст для майбутніх кроків
            last_message = claude_text
            last_speaker = "Claude"
            
        # Якщо користувач просто натиснув Enter - моделі спілкуються між собою
        else:
            if last_speaker == "Claude":
                # Claude щойно говорив, передаємо слово Gemini
                prompt = f"Твій колега Claude Opus щойно відповів:\n{last_message}\n\nЩо ти про це думаєш? Додай своє бачення або продовж роботу."
                print("\n⏳ Gemini відповідає Клоду...")
                gemini_response = gemini_chat.send_message(prompt)
                response_text = gemini_response.text
                print(f"\n🔷 [Gemini]:\n{response_text}")
                
                last_message = response_text
                last_speaker = "Gemini"
                
            elif last_speaker == "Gemini":
                # Gemini щойно говорив, передаємо слово Claude
                claude_messages.append({
                    "role": "user",
                    "content": f"Твій колега Gemini щойно відповів:\n{last_message}\n\nПрокоментуй це або продовж роботу."
                })
                print("\n⏳ Claude Opus відповідає Gemini...")
                claude_response = claude.messages.create(
                    model=CLAUDE_MODEL_NAME,
                    max_tokens=2048,
                    messages=claude_messages
                )
                claude_text = claude_response.content[0].text
                print(f"\n🔶 [Claude Opus]:\n{claude_text}")
                
                claude_messages.append({"role": "assistant", "content": claude_text})
                last_message = claude_text
                last_speaker = "Claude"
            else:
                print(" Спочатку напишіть хоча б одне завдання, щоб почати!")

    except KeyboardInterrupt:
        print("\nЗавершення роботи...")
        break
    except Exception as e:
        print(f"\nВиникла помилка: {e}")
