import os
import json
import re
import requests

# This script manages the unified projects database.
# It should be run from the root of the UlucKaymak_ProjectDatabase repository.

PROJECTS_DIR = '.'
JSON_PATH = 'projects.json'

def get_media_files(folder_path, folder_name):
    media = []
    # Scan for image, video and audio files
    extensions = ('.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.wav', '.mp3', '.mov')
    
    if not os.path.exists(folder_path):
        return []
        
    files = sorted(os.listdir(folder_path))
    for f in files:
        if f.lower().endswith(extensions):
            media.append(f"{folder_name}/{f}")
    return media

def get_steam_screenshots(url):
    """Extract AppID from Steam URL and fetch screenshot URLs via Steam API."""
    match = re.search(r'app/(\d+)', url)
    if not match:
        return []
    
    appid = match.group(1)
    api_url = f"https://store.steampowered.com/api/appdetails?appids={appid}"
    
    try:
        response = requests.get(api_url)
        if response.status_code == 200:
            data = response.json()
            if data and data.get(appid) and data[appid].get('success'):
                screenshots = data[appid]['data'].get('screenshots', [])
                # Return list of full path URLs (removing query params like ?t=...)
                return [s['path_full'].split('?')[0] for s in screenshots]
    except Exception as e:
        print(f"Error fetching Steam media: {e}")
    
    return []

def process_external_links(links_str):
    """Process a space-separated string of links, catching Steam media."""
    if not links_str:
        return []
    
    links = links_str.split()
    all_media = []
    
    for link in links:
        if 'store.steampowered.com/app/' in link:
            print(f"Detecting Steam link: {link}")
            steam_media = get_steam_screenshots(link)
            if steam_media:
                print(f"Found {len(steam_media)} Steam screenshots.")
                all_media.extend(steam_media)
            else:
                all_media.append(link) # Fallback to original link if API fails
        else:
            all_media.append(link)
            
    return all_media

def parse_date(date_str):
    """Sortable date extraction (YYYYMMDD)"""
    if not date_str:
        return "00000000"
    
    # Extract digits: 2024_09_14 -> 20240914
    digits = re.findall(r'\d+', date_str)
    
    if len(digits) >= 3:
        return digits[0].zfill(4) + digits[1].zfill(2) + digits[2].zfill(2)
    elif len(digits) == 2:
        return digits[0].zfill(4) + digits[1].zfill(2) + "00"
    elif len(digits) == 1:
        return digits[0].zfill(4) + "0000"
    
    return "00000000"

def sort_projects(projects):
    return sorted(projects, key=lambda x: parse_date(x.get('date', '')), reverse=True)

def save_json(projects_data):
    projects_data = sort_projects(projects_data)
    with open(JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(projects_data, f, indent=2, ensure_ascii=False)
    print(f"\nJSON updated and sorted by date: {JSON_PATH}")

def load_json():
    if os.path.exists(JSON_PATH):
        with open(JSON_PATH, 'r', encoding='utf-8') as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                return []
    return []

def get_new_folders(projects_data):
    existing_paths = {p.get('contentPath') for p in projects_data}
    existing_ids = {p.get('id') for p in projects_data}
    
    new_folders = []
    for d in os.listdir(PROJECTS_DIR):
        if os.path.isdir(os.path.join(PROJECTS_DIR, d)) and not d.startswith('.'):
            content_path = f"{d}/description.md"
            if content_path not in existing_paths and d not in existing_ids:
                new_folders.append(d)
    return sorted(new_folders, reverse=True)

def update_project_fields(project, folder_name):
    folder_path = os.path.join(PROJECTS_DIR, folder_name)
    local_media = get_media_files(folder_path, folder_name)
    
    # Keep existing external links (URLs) from media list
    existing_external = [m for m in project.get('media', []) if m.startswith('http')]
    
    print(f"\nCurrent external links: {len(existing_external)}")
    new_links_input = input("Enter new external links (Steam/YouTube/etc) separated by space (or press Enter to keep existing): ")
    
    if new_links_input.strip():
        new_external = process_external_links(new_links_input)
        combined_media = local_media + new_external
    else:
        combined_media = local_media + existing_external
    
    project['media'] = combined_media
    if combined_media:
        # Update thumbnail if it's missing or an mp4/wav
        if not project.get('thumbnail') or project['thumbnail'].endswith(('.mp4', '.mov', '.wav', '.mp3')):
            first_img = next((m for m in combined_media if not m.endswith(('.mp4', '.mov', '.wav', '.mp3'))), combined_media[0])
            project['thumbnail'] = first_img
    
    print(f"Media files for '{project.get('title')}' updated ({len(combined_media)} files total).")

def add_new_project(folder_name):
    folder_path = os.path.join(PROJECTS_DIR, folder_name)
    content_path = f"{folder_name}/description.md"
    
    match = re.match(r'^(\d{4}[_\d]*)-(.*)$', folder_name)
    if match:
        date_str, slug = match.groups()
    else:
        date_str, slug = "", folder_name

    local_media = get_media_files(folder_path, folder_name)
    
    links_input = input(f"Enter external links for '{folder_name}' (Steam/YouTube/etc) separated by space (optional): ")
    external_media = process_external_links(links_input)
    
    combined_media = local_media + external_media
    
    new_project = {
        "id": slug,
        "title": slug.replace('-', ' ').replace('_', ' ').title(),
        "type": "New Project",
        "date": date_str.replace('_', '-'),
        "role": "Artist",
        "thumbnail": next((m for m in combined_media if not m.endswith(('.mp4', '.mov', '.wav', '.mp3'))), combined_media[0] if combined_media else ""),
        "media": combined_media,
        "tags": ["#New"],
        "enabled": True,
        "contentPath": content_path
    }
    return new_project

def main_menu():
    projects_data = load_json()
    
    while True:
        print("\n=== Project Management Panel ===")
        print("1. Update an existing project")
        print("2. Add a new project (from folders)")
        print("3. Sort all projects by date and save")
        print("0. Exit")
        
        choice = input("\nYour choice: ")
        
        if choice == '1':
            print("\n--- Existing Projects ---")
            for i, p in enumerate(projects_data):
                print(f"{i+1}. {p.get('title')} ({p.get('date')})")
            
            try:
                p_idx = int(input("\nProject no to update (or 0 to cancel): ")) - 1
                if p_idx == -1: continue
                
                project = projects_data[p_idx]
                # Extract folder name from contentPath or thumbnail
                content_path = project.get('contentPath', '')
                if content_path:
                    folder_name = content_path.split('/')[0]
                else:
                    folder_name = project.get('thumbnail', '').split('/')[0]
                
                if folder_name:
                    update_project_fields(project, folder_name)
                else:
                    print("Error: Folder name not found.")
            except (ValueError, IndexError):
                print("Invalid choice.")
                
        elif choice == '2':
            new_folders = get_new_folders(projects_data)
            if not new_folders:
                print("\nNo new folders found.")
                continue
                
            print("\n--- New Folders ---")
            for i, f in enumerate(new_folders):
                print(f"{i+1}. {f}")
                
            try:
                f_idx = int(input("\nFolder no to add (or 0 to cancel): ")) - 1
                if f_idx == -1: continue
                
                new_project = add_new_project(new_folders[f_idx])
                projects_data.append(new_project)
                print(f"'{new_project['title']}' added.")
            except (ValueError, IndexError):
                print("Invalid choice.")
                
        elif choice == '3':
            save_json(projects_data)
            # Reload to see the sorted state
            projects_data = load_json()
            
        elif choice == '0':
            print("Exiting...")
            break
        else:
            print("Invalid choice.")

if __name__ == "__main__":
    main_menu()
