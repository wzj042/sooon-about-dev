# 读取执行目录下的 json 文件，检查 key 是否重复，如果重复，则存储冲突项；合并非重复项。

import json
import os
import glob
from typing import Dict, List, Any, Tuple
from datetime import datetime

def load_json_files(directory: str = ".") -> List[Tuple[str, Dict[str, Any]]]:
    """
    加载指定目录下的所有JSON文件
    
    Args:
        directory: 目录路径，默认为当前目录
        
    Returns:
        List[Tuple[str, Dict]]: 文件名和JSON数据的元组列表
    """
    json_files = glob.glob(os.path.join(directory, "*.json"))
    loaded_files = []
    
    for file_path in json_files:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if isinstance(data, dict):
                    loaded_files.append((os.path.basename(file_path), data))
                    print(f"✓ 成功加载: {os.path.basename(file_path)} ({len(data)} 条题目)")
                else:
                    print(f"✗ 跳过非对象文件: {os.path.basename(file_path)}")
        except Exception as e:
            print(f"✗ 加载失败: {os.path.basename(file_path)} - {e}")
    
    return loaded_files

def normalize_question_key(question_key: str, question_data: Dict[str, Any]) -> str:
    """
    标准化题目key，优先使用完整的问题文本
    
    Args:
        question_key: 原始题目key
        question_data: 题目数据
        
    Returns:
        str: 标准化后的题目key
    """
    # 如果数据中有question字段，优先使用它作为key
    if 'question' in question_data and question_data['question']:
        return question_data['question']
    
    # 否则使用原始key
    return question_key

def normalize_question_data(question_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    标准化题目数据格式
    
    Args:
        question_data: 原始题目数据
        
    Returns:
        Dict: 标准化后的题目数据
    """
    normalized = {}
    
    # 处理options字段
    if 'options' in question_data:
        normalized['options'] = question_data['options']
    
    # 处理answer字段 - 统一转换为字符串
    if 'answer' in question_data:
        answer = question_data['answer']
        if isinstance(answer, int):
            # 如果是数字索引，转换为对应的选项文本
            options = question_data.get('options', [])
            if 0 <= answer < len(options):
                normalized['answer'] = options[answer]
            else:
                normalized['answer'] = str(answer)
        else:
            normalized['answer'] = str(answer)
    
    # 保留其他字段
    for key, value in question_data.items():
        if key not in ['options', 'answer']:
            normalized[key] = value
    
    return normalized

def detect_contained_options(options: List[str]) -> bool:
    """
    检测是否存在单选项包含其余选项文本的情况
    
    Args:
        options: 选项列表
        
    Returns:
        bool: 是否存在包含情况
    """
    if len(options) < 2:
        return False
    
    for i, option1 in enumerate(options):
        for j, option2 in enumerate(options):
            if i != j and option1 in option2 and option1 != option2:
                return True
    return False

def clean_contained_options(options: List[str]) -> List[str]:
    """
    清理包含其余选项文本的选项
    
    Args:
        options: 原始选项列表
        
    Returns:
        List[str]: 清理后的选项列表
    """
    if len(options) < 2:
        return options
    
    # 按长度排序，长的在前，短的在后
    sorted_options = sorted(options, key=len, reverse=True)
    
    cleaned = []
    for option in sorted_options:
        # 检查当前选项是否包含其他已保留的选项
        is_redundant = False
        for kept_option in cleaned:
            if kept_option in option and kept_option != option:
                is_redundant = True
                break
        
        # 如果当前选项不包含其他已保留的选项，则保留
        if not is_redundant:
            cleaned.append(option)
    
    return cleaned if cleaned else options

def detect_conflicts(question_data1: Dict[str, Any], question_data2: Dict[str, Any]) -> bool:
    """
    检测两个题目数据是否存在冲突
    
    Args:
        question_data1: 第一个题目数据
        question_data2: 第二个题目数据
        
    Returns:
        bool: 是否存在冲突
    """
    # 标准化数据
    norm_data1 = normalize_question_data(question_data1)
    norm_data2 = normalize_question_data(question_data2)
    
    # 检查数据结构
    if not isinstance(norm_data1, dict) or not isinstance(norm_data2, dict):
        return True
    
    # 检查是否都有options和answer字段
    if 'options' not in norm_data1 or 'answer' not in norm_data1:
        return True
    if 'options' not in norm_data2 or 'answer' not in norm_data2:
        return True
    
    # 比较答案
    if norm_data1.get('answer') != norm_data2.get('answer'):
        return True
    
    # 比较选项（忽略顺序）
    options1 = set(norm_data1.get('options', []))
    options2 = set(norm_data2.get('options', []))
    if options1 != options2:
        return True
    
    return False

def merge_question_data(question_data1: Dict[str, Any], question_data2: Dict[str, Any]) -> Dict[str, Any]:
    """
    合并两个题目数据
    
    Args:
        question_data1: 第一个题目数据
        question_data2: 第二个题目数据
        
    Returns:
        Dict: 合并后的题目数据，如果不符合条件则返回None
    """
    # 合并选项（去重）
    options1 = question_data1.get('options', [])
    options2 = question_data2.get('options', [])
    merged_options = list(set(options1 + options2))
    
    # 检查是否存在包含其余选项的情况
    if detect_contained_options(merged_options):
        return None  # 存在包含情况，不合并
    
    # 智能合并答案 - 处理数字索引和字符型答案的优先级
    answer1 = question_data1.get('answer', '')
    answer2 = question_data2.get('answer', '')
    merged_answer = merge_answers_with_priority(answer1, answer2, merged_options)
    
    # 检查答案是否为空
    if not merged_answer or merged_answer.strip() == '':
        return None  # 答案为空，不合并
    
    # 合并其他字段，优先保留更完整的字段
    merged_data = {
        'options': merged_options,
        'answer': merged_answer
    }
    
    # 合并其他字段，优先使用有更多信息的版本
    for key in set(question_data1.keys()) | set(question_data2.keys()):
        if key not in ['options', 'answer']:
            val1 = question_data1.get(key)
            val2 = question_data2.get(key)
            # 优先使用非空值，如果都非空则使用第一个
            if val1 and not val2:
                merged_data[key] = val1
            elif val2 and not val1:
                merged_data[key] = val2
            elif val1 and val2:
                # 如果都有值，优先使用更长的字符串或更完整的对象
                if isinstance(val1, str) and isinstance(val2, str):
                    merged_data[key] = val1 if len(val1) >= len(val2) else val2
                else:
                    merged_data[key] = val1
            else:
                merged_data[key] = val1 or val2
    
    return merged_data

def merge_answers(answer1: str, answer2: str, options: List[str]) -> str:
    """
    智能合并答案，优先检查answer是否存在于options中
    
    Args:
        answer1: 第一个答案
        answer2: 第二个答案
        options: 选项列表
        
    Returns:
        str: 合并后的答案
    """
    # 如果两个答案都为空，返回空字符串
    if not answer1 and not answer2:
        return ""
    
    # 如果只有一个答案，检查是否在选项中
    if answer1 and not answer2:
        return answer1 if answer1 in options else ""
    if answer2 and not answer1:
        return answer2 if answer2 in options else ""
    
    # 如果两个答案都存在
    # 优先检查answer1是否完全匹配options中的某个选项
    if answer1 in options:
        return answer1
    
    # 如果answer1不匹配，检查answer2
    if answer2 in options:
        return answer2
    
    # 如果都不匹配，优先使用非空的答案
    return answer1 if answer1 else answer2

def merge_answers_with_priority(answer1: Any, answer2: Any, options: List[str]) -> str:
    """
    智能合并答案，处理数字索引和字符型答案的优先级
    
    Args:
        answer1: 第一个答案（可能是数字索引或字符串）
        answer2: 第二个答案（可能是数字索引或字符串）
        options: 选项列表
        
    Returns:
        str: 合并后的答案
    """
    # 转换数字索引为字符串
    def convert_answer(answer, options_list):
        if isinstance(answer, int):
            if 0 <= answer < len(options_list):
                return options_list[answer]
            else:
                return str(answer)
        return str(answer) if answer else ""
    
    # 转换答案
    answer1_text = convert_answer(answer1, options)
    answer2_text = convert_answer(answer2, options)
    
    # 如果两个答案都为空，返回空字符串
    if not answer1_text and not answer2_text:
        return ""
    
    # 如果只有一个答案，检查是否在选项中
    if answer1_text and not answer2_text:
        return answer1_text if answer1_text in options else ""
    if answer2_text and not answer1_text:
        return answer2_text if answer2_text in options else ""
    
    # 如果两个答案都存在，优先选择在选项中的答案
    if answer1_text in options and answer2_text in options:
        # 如果都在选项中，优先选择第一个
        return answer1_text
    elif answer1_text in options:
        return answer1_text
    elif answer2_text in options:
        return answer2_text
    else:
        # 如果都不在选项中，优先使用非空的答案
        return answer1_text if answer1_text else answer2_text

def merge_json_files(directory: str = ".") -> Dict[str, Any]:
    """
    合并JSON文件
    
    Args:
        directory: 目录路径
        
    Returns:
        Dict: 合并结果统计
    """
    # 加载所有JSON文件
    files_data = load_json_files(directory)
    
    if not files_data:
        print("❌ 未找到任何JSON文件")
        return {}
    
    # 合并数据
    merged_data = {}
    conflicts = {}
    stats = {
        'total_files': len(files_data),
        'total_questions': 0,
        'new_questions': 0,
        'merged_questions': 0,
        'conflict_questions': 0
    }
    
    print(f"\n开始合并 {len(files_data)} 个文件...")
    
    for filename, file_data in files_data:
        print(f"\n处理文件: {filename}")
        file_stats = {'new': 0, 'merged': 0, 'conflicts': 0}
        
        for question, question_data in file_data.items():
            stats['total_questions'] += 1
            
            # 标准化题目key
            normalized_key = normalize_question_key(question, question_data)
            
            if normalized_key not in merged_data:
                # 新题目，检查是否符合条件
                options = question_data.get('options', [])
                answer = question_data.get('answer', '')
                
                # 检查是否存在包含选项的情况
                if detect_contained_options(options):
                    # 存在包含情况，记录为冲突
                    if normalized_key not in conflicts:
                        conflicts[normalized_key] = {
                            'existing': question_data,
                            'conflicting_files': []
                        }
                    file_stats['conflicts'] += 1
                    stats['conflict_questions'] += 1
                # 检查答案是否为空
                elif not answer or str(answer).strip() == '':
                    # 答案为空，记录为冲突
                    if normalized_key not in conflicts:
                        conflicts[normalized_key] = {
                            'existing': question_data,
                            'conflicting_files': []
                        }
                    file_stats['conflicts'] += 1
                    stats['conflict_questions'] += 1
                else:
                    # 符合条件，添加新题目
                    merged_data[normalized_key] = question_data
                    file_stats['new'] += 1
                    stats['new_questions'] += 1
            else:
                # 检查冲突
                if detect_conflicts(merged_data[normalized_key], question_data):
                    # 存在冲突，记录到冲突列表
                    if normalized_key not in conflicts:
                        conflicts[normalized_key] = {
                            'existing': merged_data[normalized_key],
                            'conflicting_files': []
                        }
                    
                    conflicts[normalized_key]['conflicting_files'].append({
                        'file': filename,
                        'data': question_data
                    })
                    file_stats['conflicts'] += 1
                    stats['conflict_questions'] += 1
                else:
                    # 无冲突，合并数据
                    merged_result = merge_question_data(merged_data[normalized_key], question_data)
                    if merged_result is not None:
                        merged_data[normalized_key] = merged_result
                        file_stats['merged'] += 1
                        stats['merged_questions'] += 1
                    else:
                        # 合并失败（存在包含选项或答案为空），记录为冲突
                        if normalized_key not in conflicts:
                            conflicts[normalized_key] = {
                                'existing': merged_data[normalized_key],
                                'conflicting_files': []
                            }
                        
                        conflicts[normalized_key]['conflicting_files'].append({
                            'file': filename,
                            'data': question_data
                        })
                        file_stats['conflicts'] += 1
                        stats['conflict_questions'] += 1
        
        print(f"  - 新增: {file_stats['new']} 题")
        print(f"  - 合并: {file_stats['merged']} 题")
        print(f"  - 冲突: {file_stats['conflicts']} 题")
    
    # 生成报告
    print(f"\n{'='*50}")
    print("合并完成！")
    print(f"{'='*50}")
    print(f"总文件数: {stats['total_files']}")
    print(f"总题目数: {stats['total_questions']}")
    print(f"新增题目: {stats['new_questions']}")
    print(f"合并题目: {stats['merged_questions']}")
    print(f"冲突题目: {stats['conflict_questions']}")
    print(f"最终题目数: {len(merged_data)}")
    
    # 保存合并结果
    output_filename = f"merged_questions_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(output_filename, 'w', encoding='utf-8') as f:
        json.dump(merged_data, f, ensure_ascii=False, indent=2)
    print(f"\n✓ 合并结果已保存到: {output_filename}")
    
    # 保存冲突报告
    if conflicts:
        conflict_filename = f"conflicts_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(conflict_filename, 'w', encoding='utf-8') as f:
            json.dump(conflicts, f, ensure_ascii=False, indent=2)
        print(f"⚠ 冲突报告已保存到: {conflict_filename}")
        
        print(f"\n冲突详情:")
        for question, conflict_info in conflicts.items():
            print(f"\n题目: {question}")
            print(f"  现有答案: {conflict_info['existing'].get('answer', 'N/A')}")
            print(f"  现有选项: {conflict_info['existing'].get('options', [])}")
            for conflict in conflict_info['conflicting_files']:
                print(f"  冲突文件: {conflict['file']}")
                print(f"    答案: {conflict['data'].get('answer', 'N/A')}")
                print(f"    选项: {conflict['data'].get('options', [])}")
    
    return stats

if __name__ == "__main__":
    print("素问抢答题库合并工具")
    print("="*50)
    
    # 获取当前目录
    current_dir = os.getcwd()
    print(f"工作目录: {current_dir}")
    
    # 执行合并
    merge_json_files(current_dir)
