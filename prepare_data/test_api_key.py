import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv()

GOOGLE_API_KEY = os.environ["GOOGLE_API_KEY"]

def list_available_models():

    try:
        genai.configure(api_key=GOOGLE_API_KEY)
        
        print(f" Đang kết nối đến Google với Key: {GOOGLE_API_KEY[:10]}...")
        
        all_models = list(genai.list_models())
        
        print("\n" + "="*50)
        print("CÁC MODEL CHAT/TEXT (Dùng cho LLM)")
        print("="*50)
        chat_models = [m for m in all_models if 'generateContent' in m.supported_generation_methods]
        if chat_models:
            for m in chat_models:
                print(f" {m.name}")
        else:
            print(" Không tìm thấy model Chat nào (Kiểm tra lại quyền hạn Key)")

        print("\n" + "="*50)
        print("CÁC MODEL EMBEDDING (Dùng cho Vector DB)")
        print("="*50)
        embed_models = [m for m in all_models if 'embedContent' in m.supported_generation_methods]
        if embed_models:
            for m in embed_models:
                print(f" {m.name}")
        else:
            print(" Không tìm thấy model Embedding nào.")
            
    except Exception as e:
        print(f"\n LỖI KẾT NỐI: {e}")
        print("Gợi ý: Key sai, hết hạn, hoặc chưa bật Google AI Studio.")

if __name__ == "__main__":
    list_available_models()