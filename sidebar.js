document.addEventListener('DOMContentLoaded', async () => {
    // DOM 요소들
    const memoForm = document.getElementById('memo-form');
    const memoInput = document.getElementById('memo-input');
    const categoryAccordion = document.getElementById('category-accordion');
    const addCategoryBtn = document.getElementById('add-category-btn');
    const viewModal = document.getElementById('view-modal');
    const editModal = document.getElementById('edit-modal');
    const closeModalBtns = document.querySelectorAll('.close-btn');
    const editForm = document.getElementById('edit-form');
    const editContent = document.getElementById('edit-content');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const datetimeElement = document.getElementById('current-datetime');

    // 상태 변수들
    let categories = [];
    let memos = [];
    let expandedCategories = new Set();
    let currentEditingMemoId = null;

    // 기본 카테고리 데이터
    const defaultCategories = [
        { name: '계약', color: '#3498db', icon: '📄' },
        { name: '광고', color: '#e74c3c', icon: '📢' },
        { name: '기타', color: '#95a5a6', icon: '📌' }
    ];

    // 데이터 로드 및 저장
    const loadData = async () => {
        try {
            const result = await chrome.storage.local.get(['memos', 'categories', 'expandedCategories']);
            memos = result.memos || [];
            categories = result.categories || defaultCategories;
            expandedCategories = new Set(result.expandedCategories || []);
        } catch (error) {
            console.error('데이터 로드 실패:', error);
            categories = defaultCategories;
            memos = [];
            expandedCategories = new Set();
        }
    };

    const saveData = async () => {
        try {
            await chrome.storage.local.set({
                memos: memos,
                categories: categories,
                expandedCategories: Array.from(expandedCategories)
            });
        } catch (error) {
            console.error('데이터 저장 실패:', error);
        }
    };

    // 유틸리티 함수들
    const generateId = () => Date.now().toString() + Math.random().toString(36).substr(2, 9);

    const getFirstLine = (text) => {
        const lines = text.trim().split('\n');
        return lines[0] || '제목 없음';
    };

    const linkify = (text) => {
        if (!text) return '';
        
        // 마크다운 링크 처리
        text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
        
        // 일반 URL 처리
        const urlRegex = /(\b(https?|ftp):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])|(\bwww\.[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gi;
        text = text.replace(urlRegex, (url) => {
            if (text.includes(`href="${url}`) || text.includes(`href="http://${url.replace('www.', '')}`)) {
                return url;
            }
            let href = url.startsWith('www.') ? 'http://' + url : url;
            return `<a href="${href}" target="_blank" rel="noopener noreferrer">${url}</a>`;
        });
        
        return text;
    };

    // 시간 업데이트
    const updateDateTime = () => {
        const now = new Date();
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const date = now.getDate();
        const dayOfWeek = days[now.getDay()];
        let hours = now.getHours();
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? '오후' : '오전';
        hours = hours % 12;
        hours = hours ? hours : 12;

        const formattedDateTime = `${year}년 ${month}월 ${date}일 (${dayOfWeek}) ${ampm} ${hours}:${minutes}`;
        datetimeElement.textContent = formattedDateTime;
    };

    // 카테고리 렌더링
    const renderCategories = () => {
        categoryAccordion.innerHTML = '';

        categories.forEach(category => {
            const categoryMemos = memos.filter(memo => memo.category === category.name);
            const bookmarkedMemos = categoryMemos.filter(memo => memo.isBookmarked);
            const regularMemos = categoryMemos.filter(memo => !memo.isBookmarked);
            const sortedMemos = [...bookmarkedMemos, ...regularMemos];

            const categoryContainer = document.createElement('div');
            categoryContainer.className = 'category-container';
            categoryContainer.dataset.category = category.name;

            const isExpanded = expandedCategories.has(category.name);

            categoryContainer.innerHTML = `
                <button class="category-header ${isExpanded ? 'active' : ''}" data-category="${category.name}">
                    <div class="category-title">
                        <span style="font-size: 18px;">${category.icon}</span>
                        <span>${category.name}</span>
                        <span class="memo-count">${categoryMemos.length}</span>
                    </div>
                    <div class="category-actions">
                        <button class="edit-category-btn" data-category="${category.name}" title="이름 수정">수정</button>
                        <button class="delete-category-btn" data-category="${category.name}" title="카테고리 삭제">삭제</button>
                        <span class="category-toggle ${isExpanded ? 'expanded' : ''}">▼</span>
                    </div>
                </button>
                <ul class="memo-list ${isExpanded ? 'expanded' : ''}" data-category="${category.name}">
                    ${sortedMemos.length === 0 
                        ? '<div class="empty-category"><p>메모가 없습니다.</p></div>'
                        : sortedMemos.map(memo => `
                            <li class="memo-item ${memo.isBookmarked ? 'bookmarked' : ''}" data-id="${memo.id}">
                                <div class="memo-header">
                                    <div class="memo-title">${getFirstLine(memo.content)}</div>
                                    <div class="memo-actions">
                                        <button class="bookmark-btn ${memo.isBookmarked ? 'bookmarked' : ''}" data-id="${memo.id}">
                                            ${memo.isBookmarked ? '⭐' : '☆'}
                                        </button>
                                    </div>
                                </div>
                                <div class="memo-preview">${memo.content.substring(0, 100)}${memo.content.length > 100 ? '...' : ''}</div>
                            </li>
                        `).join('')
                    }
                </ul>
            `;

            categoryAccordion.appendChild(categoryContainer);
        });

        // 이벤트 리스너 등록
        attachCategoryEventListeners();
    };

    // 카테고리 이벤트 리스너
    const attachCategoryEventListeners = () => {
        // 카테고리 헤더 클릭 (확장/축소)
        categoryAccordion.querySelectorAll('.category-header').forEach(header => {
            header.addEventListener('click', (e) => {
                // 편집/삭제 버튼 클릭 시 아코디언 토글 방지
                if (e.target.classList.contains('edit-category-btn') || 
                    e.target.classList.contains('delete-category-btn') ||
                    e.target.closest('.edit-category-btn') ||
                    e.target.closest('.delete-category-btn')) {
                    return;
                }

                e.preventDefault();
                e.stopPropagation();

                const categoryName = header.dataset.category;
                const memoList = header.nextElementSibling;
                const toggle = header.querySelector('.category-toggle');

                console.log('토글 클릭:', categoryName, expandedCategories.has(categoryName));

                if (expandedCategories.has(categoryName)) {
                    // 축소
                    expandedCategories.delete(categoryName);
                    header.classList.remove('active');
                    memoList.classList.remove('expanded');
                    if (toggle) toggle.classList.remove('expanded');
                } else {
                    // 확장
                    expandedCategories.add(categoryName);
                    header.classList.add('active');
                    memoList.classList.add('expanded');
                    if (toggle) toggle.classList.add('expanded');
                }

                saveData();
            });
        });

        // 카테고리 편집/삭제 버튼
        categoryAccordion.querySelectorAll('.edit-category-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                editCategoryName(btn.dataset.category);
            });
        });

        categoryAccordion.querySelectorAll('.delete-category-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteCategory(btn.dataset.category);
            });
        });

        // 메모 클릭
        categoryAccordion.querySelectorAll('.memo-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.classList.contains('bookmark-btn')) {
                    return;
                }
                const memoId = item.dataset.id;
                showMemoModal(memoId);
            });
        });

        // 북마크 버튼
        categoryAccordion.querySelectorAll('.bookmark-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleBookmark(btn.dataset.id);
            });
        });
    };

    // 메모 관련 함수들
    const addMemo = async (content) => {
        if (!content.trim()) return;

        const firstCategory = categories[0];
        if (!firstCategory) return;

        const newMemo = {
            id: generateId(),
            content: content.trim(),
            category: firstCategory.name,
            isBookmarked: false,
            createdAt: new Date().toISOString()
        };

        memos.unshift(newMemo);
        await saveData();
        renderCategories();
    };

    const showMemoModal = (memoId) => {
        const memo = memos.find(m => m.id === memoId);
        if (!memo) return;

        document.getElementById('view-title').textContent = getFirstLine(memo.content);
        
        // 마크다운 지원이 있다면 사용, 없다면 기본 링크 처리
        let processedContent;
        if (typeof marked !== 'undefined') {
            processedContent = marked.parse ? marked.parse(memo.content) : marked(memo.content);
        } else {
            processedContent = linkify(memo.content.replace(/\n/g, '<br>'));
        }
        
        document.getElementById('view-content').innerHTML = processedContent;

        // 모달 푸터에 버튼들 추가
        const modalFooter = document.getElementById('view-modal-footer');
        modalFooter.innerHTML = `
            <button class="modal-btn copy-btn" data-memo-id="${memoId}">복사</button>
            <button class="modal-btn edit-btn" data-memo-id="${memoId}">수정</button>
            <button class="modal-btn delete-btn" data-memo-id="${memoId}">삭제</button>
        `;

        // 버튼 이벤트 리스너 추가
        const copyBtn = modalFooter.querySelector('.copy-btn');
        const editBtn = modalFooter.querySelector('.edit-btn');
        const deleteBtn = modalFooter.querySelector('.delete-btn');

        copyBtn.addEventListener('click', () => copyMemoContent(memoId));
        editBtn.addEventListener('click', () => editMemo(memoId));
        deleteBtn.addEventListener('click', () => deleteMemo(memoId));

        viewModal.style.display = 'block';
    };

    const toggleBookmark = async (memoId) => {
        const memo = memos.find(m => m.id === memoId);
        if (!memo) return;

        memo.isBookmarked = !memo.isBookmarked;
        await saveData();
        renderCategories();
    };

    // 메모 액션 함수들
    const copyMemoContent = async (memoId) => {
        const memo = memos.find(m => m.id === memoId);
        if (!memo) return;

        try {
            await navigator.clipboard.writeText(memo.content);
            const copyBtn = document.querySelector('.copy-btn');
            if (copyBtn) {
                const originalText = copyBtn.textContent;
                copyBtn.textContent = '복사 완료!';
                setTimeout(() => {
                    copyBtn.textContent = originalText;
                }, 1500);
            }
        } catch (error) {
            console.error('복사 실패:', error);
        }
    };

    const editMemo = (memoId) => {
        const memo = memos.find(m => m.id === memoId);
        if (!memo) return;

        currentEditingMemoId = memoId;
        editContent.value = memo.content;
        viewModal.style.display = 'none';
        editModal.style.display = 'block';
    };

    const deleteMemo = async (memoId) => {
        if (!confirm('이 메모를 삭제하시겠습니까?')) return;

        memos = memos.filter(m => m.id !== memoId);
        await saveData();
        renderCategories();
        viewModal.style.display = 'none';
    };

    // 카테고리 관리 함수들
    const addCategory = async () => {
        const categoryName = prompt('새 카테고리 이름을 입력하세요:');
        if (!categoryName || !categoryName.trim()) return;

        const trimmedName = categoryName.trim();
        if (categories.find(c => c.name === trimmedName)) {
            alert('이미 존재하는 카테고리입니다.');
            return;
        }

        const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];
        const icons = ['📝', '💼', '🎯', '💡', '📊', '🔖', '📌', '🎨', '🔬', '🎭'];
        
        const newCategory = {
            name: trimmedName,
            color: colors[Math.floor(Math.random() * colors.length)],
            icon: icons[Math.floor(Math.random() * icons.length)]
        };

        categories.push(newCategory);
        expandedCategories.add(trimmedName);
        await saveData();
        renderCategories();
    };

    const editCategoryName = async (oldName) => {
        const newName = prompt('새 카테고리 이름을 입력하세요:', oldName);
        if (!newName || !newName.trim() || newName.trim() === oldName) return;

        const trimmedName = newName.trim();
        if (categories.find(c => c.name === trimmedName)) {
            alert('이미 존재하는 카테고리입니다.');
            return;
        }

        // 카테고리 이름 업데이트
        const category = categories.find(c => c.name === oldName);
        if (category) {
            category.name = trimmedName;
        }

        // 해당 카테고리의 모든 메모 업데이트
        memos.forEach(memo => {
            if (memo.category === oldName) {
                memo.category = trimmedName;
            }
        });

        // 확장 상태 업데이트
        if (expandedCategories.has(oldName)) {
            expandedCategories.delete(oldName);
            expandedCategories.add(trimmedName);
        }

        await saveData();
        renderCategories();
    };

    const deleteCategory = async (categoryName) => {
        const categoryMemos = memos.filter(m => m.category === categoryName);
        const confirmMessage = categoryMemos.length > 0 
            ? `'${categoryName}' 카테고리와 포함된 ${categoryMemos.length}개의 메모를 모두 삭제하시겠습니까?`
            : `'${categoryName}' 카테고리를 삭제하시겠습니까?`;

        if (!confirm(confirmMessage)) return;

        // 카테고리 삭제
        categories = categories.filter(c => c.name !== categoryName);
        
        // 해당 카테고리의 모든 메모 삭제
        memos = memos.filter(m => m.category !== categoryName);
        
        // 확장 상태에서 제거
        expandedCategories.delete(categoryName);

        await saveData();
        renderCategories();
    };

    // 이벤트 리스너들
    memoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const content = memoInput.value.trim();
        if (!content) return;

        await addMemo(content);
        memoInput.value = '';
    });

    addCategoryBtn.addEventListener('click', addCategory);

    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentEditingMemoId) return;

        const newContent = editContent.value.trim();
        if (!newContent) return;

        const memo = memos.find(m => m.id === currentEditingMemoId);
        if (memo) {
            memo.content = newContent;
            await saveData();
            renderCategories();
        }

        editModal.style.display = 'none';
        currentEditingMemoId = null;
    });

    cancelEditBtn.addEventListener('click', () => {
        editModal.style.display = 'none';
        currentEditingMemoId = null;
    });

    // 모달 닫기
    closeModalBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            if (modal) {
                modal.style.display = 'none';
                if (modal === editModal) {
                    currentEditingMemoId = null;
                }
            }
        });
    });

    // 모달 외부 클릭으로 닫기
    window.addEventListener('click', (e) => {
        if (e.target === viewModal) {
            viewModal.style.display = 'none';
        }
        if (e.target === editModal) {
            editModal.style.display = 'none';
            currentEditingMemoId = null;
        }
    });

    // 초기화
    const initialize = async () => {
        console.log('앱 초기화 시작');
        await loadData();
        console.log('데이터 로드 완료:', { categories: categories.length, memos: memos.length, expandedCategories: Array.from(expandedCategories) });
        
        // 첫 번째 카테고리를 기본으로 확장
        if (categories.length > 0 && expandedCategories.size === 0) {
            expandedCategories.add(categories[0].name);
            console.log('첫 번째 카테고리 확장:', categories[0].name);
            await saveData();
        }
        
        renderCategories();
        updateDateTime();
        setInterval(updateDateTime, 1000);
        console.log('앱 초기화 완료');
    };

    // 앱 시작
    await initialize();
});