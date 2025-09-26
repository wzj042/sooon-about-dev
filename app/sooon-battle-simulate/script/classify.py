import os
import json
from openai import OpenAI  # 使用 OpenAI 包
from tqdm import tqdm # 引入tqdm来显示进度条

# --- 配置 ---
API_KEY = 'sk-'

MODEL_NAME = "deepseek-chat" 

# 输入和输出文件名
# 拼接脚本所在目录
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_JSON_PATH = os.path.join(SCRIPT_DIR, "qb.json")
OUTPUT_JSON_PATH = os.path.join(SCRIPT_DIR, "questions_classified.json")

# 初始化 DeepSeek 客户端
client = OpenAI(
    api_key=API_KEY,
    base_url="https://api.deepseek.com"  # DeepSeek API 端点
)

def get_question_type(question: str, options: list) -> str:
    """
    使用 DeepSeek API 判断问题的类型。

    Args:
        question (str): 问题文本。
        options (list): 问题的选项列表。

    Returns:
        str: 'sooon_ai' 或 'common_sense'。
    """
    # 将选项格式化以便模型更好地理解
    formatted_options = "\n".join([f"{i+1}. {opt}" for i, opt in enumerate(options)])
    
    # 精心设计的 Prompt (指令)
    prompt_messages = [
        {
            "role": "system",
            "content": """
你是一个精确的问题分类助手。你的任务是将用户提供的问题分为两类：`sooon_ai` 或 `common_sense`。

分类标准如下：
1. `sooon_ai` (偏伦理观念): 这类问题涉及社会规范、道德伦理、价值观、人际关系或主观判断。其“最佳”答案通常依赖于道德或社会框架，而非一个客观事实。
2. `common_sense` (偏百科常识): 这类问题通常有一个唯一的、明确的、基于事实或广泛共识的正确答案。它们考验的是关于世界、规则、法律或客观事实的知识。

你的回答必须且只能是 `sooon_ai` 或 `common_sense` 这两个词之一，不要包含任何解释、标点符号或其他多余的文字。
"""
        },
        {
            "role": "user",
            "content": f"""
请对以下问题进行分类：

问题: {question}
选项:
{formatted_options}
"""
        }
    ]

    try:
        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=prompt_messages,
            max_tokens=10,  # 只需要返回一个词，设置较小的 max_tokens
            temperature=0,  # 分类任务，使用最低的温度以保证结果稳定
        )
        
        classification = response.choices[0].message.content.strip()

        # 校验返回结果，如果不是预期的两种，则给一个默认值
        if classification in ['sooon_ai', 'common_sense']:
            return classification
        else:
            print(f"警告: 模型返回了意外的结果 '{classification}'，将默认标记为 'common_sense'。")
            return 'common_sense'

    except Exception as e:
        print(f"调用 API 时发生错误: {e}")
        # 发生错误时返回一个默认值或 None
        return 'error'

def classify_and_update_json(input_path: str, output_path: str):
    """
    读取 JSON 文件，为每个问题添加 'type' 字段，并保存到新文件。
    """
    try:
        with open(input_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"错误: 输入文件 '{input_path}' 未找到。")
        return
    except json.JSONDecodeError:
        print(f"错误: 文件 '{input_path}' 不是有效的 JSON 格式。")
        return

    print(f"开始分类 '{input_path}' 中的 {len(data)} 个问题...")

    # 使用 tqdm 创建一个进度条
    for question, details in tqdm(data.items(), desc="分类进度"):
        # 如果已经分类过，则跳过
        if 'type' in details:
            continue
            
        question_type = get_question _type(question, details.get("options", []))
        details['type'] = question_type

    print("所有问题分类完成！")

    # 将更新后的数据写入新文件
    with open(output_path, 'w', encoding='utf-8') as f:
        # indent=2 使 JSON 文件格式化，更易读
        # ensure_ascii=False 保证中文字符能正确显示
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"分类结果已保存至 '{output_path}'。")


def create_sample_json_if_not_exists(file_path: str):
    """如果输入文件不存在，则创建一个示例文件。"""
    if not os.path.exists(file_path):
        print(f"'{file_path}' 不存在，将创建一个示例文件。")
        sample_data = {
            "发现自己没有能力按计划完成工作，应该____。": {
                "options": [
                    "隐瞒自己的无能，不做任何说明",
                    "将任务强行推给其他同事",
                    "老实承认并基于了解提出补救方案",
                    "强行接受任务，事后推脱责任"
                ],
                "answer": 2,
                "updated_at": "2025-09-15 11:01:56"
            },
            "驾驶人在道路上驾驶机动车时，______。": {
                "options": [
                    "只需携带驾驶证",
                    "应携带出厂合格证明或进口凭证",
                    "必须携带驾驶证、行驶证",
                    "只需携带行驶证"
                ],
                "answer": 2, # 注意：这里的答案我根据常识修正了一下，原题答案可能需要核对
                "updated_at": "2025-09-15 11:52:31"
            },
            "根据《中华人民共和国国歌法》，在下列哪个场合不得奏唱国歌？": {
                "options": [
                    "全国人民代表大会开幕式",
                    "宪法宣誓仪式",
                    "商业广告",
                    "重大体育赛事开幕式"
                ],
                "answer": 2,
                "updated_at": "2025-09-15 12:00:00"
            },
            "当朋友向你倾诉烦恼时，比较合适的做法是？": {
                "options": [
                    "立即打断并分享自己更糟的经历",
                    "安静地倾听，并表示理解和支持",
                    "直接给出解决方案，告诉他应该怎么做",
                    "告诉他这只是小事，没必要烦恼"
                ],
                "answer": 1,
                "updated_at": "2025-09-15 12:05:00"
            }
        }
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(sample_data, f, indent=2, ensure_ascii=False)
        print(f"示例文件 '{file_path}' 创建成功。")


if __name__ == "__main__":
    # 检查并创建示例输入文件
    create_sample_json_if_not_exists(INPUT_JSON_PATH)
    
    # 运行主程序
    classify_and_update_json(INPUT_JSON_PATH, OUTPUT_JSON_PATH)