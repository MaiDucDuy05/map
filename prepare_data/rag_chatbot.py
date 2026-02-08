import os
import textwrap
from pathlib import Path

# Import LangChain
from langchain_chroma import Chroma
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain.chains.retrieval import create_retrieval_chain
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).parent
CHROMA_PATH = BASE_DIR / "chroma_db_langchain"
GOOGLE_API_KEY = os.environ["GOOGLE_API_KEY"]


def main():
    print(" Đang khởi động Chatbot Du lịch Hà Nội...")

    embeddings = GoogleGenerativeAIEmbeddings(
        model="models/gemini-embedding-001", 
        task_type="retrieval_query", 
        google_api_key=GOOGLE_API_KEY
    )

    # 2. LOAD DATABASE ĐÃ CÓ
    if not CHROMA_PATH.exists():
        print(f"Lỗi: Không tìm thấy thư mục {CHROMA_PATH}")
        return

    vector_store = Chroma(
        persist_directory=str(CHROMA_PATH),
        embedding_function=embeddings
    )
    
    # Test nhanh xem DB có dữ liệu không
    count = vector_store._collection.count()
    print(f" Đã kết nối thành công! Database đang chứa {count} kiến thức.")

    # 3. KHỞI TẠO LLM (GEMINI) ĐỂ TRẢ LỜI
    llm = ChatGoogleGenerativeAI(
        model="models/gemini-flash-latest",
        temperature=0.3, 
        max_tokens=2048
    )

    template = """
    Bạn là một hướng dẫn viên du lịch Hà Nội thân thiện và am hiểu.
    Hãy sử dụng thông tin ngữ cảnh dưới đây để trả lời câu hỏi của người dùng.
    
    Nếu thông tin không có trong ngữ cảnh, hãy nói thật là bạn không biết, đừng cố bịa ra.
    Câu trả lời cần ngắn gọn, xúc tích nhưng đầy đủ thông tin (địa chỉ, giá vé, tips nếu có).

    Ngữ cảnh (Thông tin tìm được):
    {context}

    Câu hỏi của khách: {input}

    Câu trả lời:
    """
    
    prompt = PromptTemplate(
        template=template, 
        input_variables=["context", "input"]
    )


    retriever = vector_store.as_retriever(search_kwargs={"k": 3})

    document_chain = create_stuff_documents_chain(
        llm=llm,
        prompt=prompt
    )
    
    qa_chain = create_retrieval_chain(retriever, document_chain)

    print("\n" + "="*50)
    print("CHATBOT ĐÃ SẴN SÀNG! (Gõ 'exit' để thoát)")
    print("="*50)

    while True:
        query = input("\nKhách du lịch: ").strip()
        
        if query.lower() in ["exit", "quit", "thoat"]:
            print("Hẹn gặp lại quý khách!")
            break
        
        if not query: continue

        print("... Đang tìm kiếm thông tin ...")
        
        try:
            response = qa_chain.invoke({"input": query})
            
            print(f"\n Hướng dẫn viên AI:\n{textwrap.fill(response['answer'], width=80)}")
            
            print("   DEBUG: CONTEXT ĐƯỢC GỬI VÀO PROMPT")

            
            context_docs = response.get('context', [])
            
            if not context_docs:
                print("Không tìm thấy văn bản nào liên quan!")
            else:
                for i, doc in enumerate(context_docs):
                    source_name = doc.metadata.get('name', 'Nguồn ẩn')
                    
                    content_preview = doc.page_content.replace('\n', ' ')
                    
                    print(f"\n [Tài liệu #{i+1}] - Nguồn: {source_name}")
                    print(f"   Nội dung trích xuất:")
                    print(textwrap.fill(content_preview, width=80, initial_indent='   ', subsequent_indent='   '))
                    print("-" * 40)
            
            print("="*50)
                
        except Exception as e:
            print(f" Có lỗi xảy ra: {e}")

if __name__ == "__main__":
    main()

