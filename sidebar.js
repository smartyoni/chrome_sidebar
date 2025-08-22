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

    // 선명하고 예쁜 색상 팔레트
    const prettyColors = [
        '#FF4757', '#3742FA', '#2ED573', '#FFA502', '#FF6B35',
        '#5352ED', '#FF3838', '#00D2D3', '#FFC312', '#C44569',
        '#40407A', '#706FD3', '#F97F51', '#1DD1A1', '#55A3FF',
        '#26DE81', '#FD79A8', '#FDCB6E', '#6C5CE7', '#74B9FF',
        '#00B894', '#E17055', '#81ECEC', '#FAB1A0', '#00CEC9'
    ];

    // 기본 카테고리 데이터 (IN-BOX는 삭제 불가)
    const defaultCategories = [
        { name: 'IN-BOX', color: '#FF6B9D', isDeletable: false },
        { name: '계약', color: getRandomPrettyColor(), isDeletable: true },
        { name: '광고', color: getRandomPrettyColor(), isDeletable: true },
        { name: '기타', color: getRandomPrettyColor(), isDeletable: true }
    ];

    // 랜덤 예쁜 색상 선택 함수
    function getRandomPrettyColor() {
        return prettyColors[Math.floor(Math.random() * prettyColors.length)];
    }

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

            // 카테고리 삭제 가능 여부 확인
            const isDeletable = category.isDeletable !== false; // 기본값은 true
            
            categoryContainer.innerHTML = `
                <div class="category-header ${isExpanded ? 'active' : ''}" data-category="${category.name}" style="border-left: 4px solid ${category.color};">
                    <div class="category-title">
                        <span>${category.name}</span>
                        <span class="memo-count" style="background: ${category.color}20; color: ${category.color};">${categoryMemos.length}</span>
                    </div>
                    <div class="category-actions">
                        ${isDeletable ? `<button class="edit-category-btn" data-category="${category.name}" title="이름 수정">수정</button>` : ''}
                        ${isDeletable ? `<button class="delete-category-btn" data-category="${category.name}" title="카테고리 삭제">삭제</button>` : ''}
                        <span class="category-toggle ${isExpanded ? 'expanded' : ''}">▼</span>
                    </div>
                </div>
                <ul class="memo-list ${isExpanded ? 'expanded' : ''}" data-category="${category.name}">
                    ${sortedMemos.length === 0 
                        ? '<div class="empty-category"><p>메모가 없습니다.</p></div>'
                        : sortedMemos.map(memo => `
                            <li class="memo-item ${memo.isBookmarked ? 'bookmarked' : ''}" data-id="${memo.id}" style="border-left-color: ${category.color};">
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
        
        // 초기 상태 확인 로그
        console.log('카테고리 렌더링 완료. 확장된 카테고리:', Array.from(expandedCategories));
    };

    // 카테고리 이벤트 리스너
    const attachCategoryEventListeners = () => {
        console.log('=== 이벤트 리스너 연결 ===');
        
        // 카테고리 헤더 클릭 (확장/축소)
        categoryAccordion.querySelectorAll('.category-header').forEach((header, index) => {
            console.log(`헤더 ${index}: ${header.dataset.category}`);
            
            header.addEventListener('click', (e) => {
                console.log('🎯 클릭 감지!', e.target.tagName, e.target.className);
                
                // 편집/삭제 버튼 클릭은 무시
                if (e.target.tagName === 'BUTTON') {
                    console.log('버튼 클릭 무시');
                    return;
                }

                const categoryName = header.dataset.category;
                const memoList = header.nextElementSibling;
                const toggle = header.querySelector('.category-toggle');

                console.log('🔄 토글 실행:', categoryName);
                console.log('현재 상태:', expandedCategories.has(categoryName) ? '확장됨' : '축소됨');

                if (expandedCategories.has(categoryName)) {
                    // 축소
                    console.log('➡️ 축소');
                    expandedCategories.delete(categoryName);
                    header.classList.remove('active');
                    memoList.classList.remove('expanded');
                    if (toggle) toggle.classList.remove('expanded');
                } else {
                    // 확장
                    console.log('⬇️ 확장');
                    expandedCategories.add(categoryName);
                    header.classList.add('active');
                    memoList.classList.add('expanded');
                    if (toggle) toggle.classList.add('expanded');
                }

                console.log('새 상태:', expandedCategories.has(categoryName) ? '확장됨' : '축소됨');
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

        // 항상 IN-BOX 카테고리로 메모 추가
        const inboxCategory = categories.find(cat => cat.name === 'IN-BOX');
        const targetCategory = inboxCategory ? inboxCategory.name : 'IN-BOX';

        const newMemo = {
            id: generateId(),
            content: content.trim(),
            category: targetCategory,
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

        const newCategory = {
            name: trimmedName,
            color: getRandomPrettyColor(),
            isDeletable: true
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
        // IN-BOX 카테고리는 삭제 불가
        if (categoryName === 'IN-BOX') {
            alert('IN-BOX 카테고리는 삭제할 수 없습니다.');
            return;
        }

        const category = categories.find(c => c.name === categoryName);
        if (category && category.isDeletable === false) {
            alert('이 카테고리는 삭제할 수 없습니다.');
            return;
        }

        const categoryMemos = memos.filter(m => m.category === categoryName);
        let confirmMessage;
        
        if (categoryMemos.length > 0) {
            confirmMessage = `'${categoryName}' 카테고리를 삭제하면 포함된 ${categoryMemos.length}개의 메모가 IN-BOX로 이동됩니다. 계속하시겠습니까?`;
        } else {
            confirmMessage = `'${categoryName}' 카테고리를 삭제하시겠습니까?`;
        }

        if (!confirm(confirmMessage)) return;

        // 카테고리 삭제
        categories = categories.filter(c => c.name !== categoryName);
        
        // 해당 카테고리의 모든 메모를 IN-BOX로 이동
        memos.forEach(memo => {
            if (memo.category === categoryName) {
                memo.category = 'IN-BOX';
            }
        });
        
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
        
        // IN-BOX 카테고리를 기본으로 확장
        if (categories.length > 0 && expandedCategories.size === 0) {
            const inboxCategory = categories.find(cat => cat.name === 'IN-BOX');
            const defaultExpanded = inboxCategory ? inboxCategory.name : categories[0].name;
            expandedCategories.add(defaultExpanded);
            console.log('기본 카테고리 확장:', defaultExpanded);
            await saveData();
        }
        
        renderCategories();
        updateDateTime();
        setInterval(updateDateTime, 1000);
        console.log('앱 초기화 완료');
    };

    // 디버깅용 전역 함수
    window.testAccordion = () => {
        console.log('=== 아코디언 디버깅 ===');
        console.log('카테고리 수:', categories.length);
        console.log('확장된 카테고리:', Array.from(expandedCategories));
        
        const headers = document.querySelectorAll('.category-header');
        console.log('헤더 요소 수:', headers.length);
        
        headers.forEach((header, i) => {
            console.log(`헤더 ${i}:`, header.dataset.category, header.classList.contains('active'));
            console.log(`  - 태그명: ${header.tagName}`);
            console.log(`  - 클릭 이벤트 수신 가능: ${header.onclick !== null || header.addEventListener !== undefined}`);
        });
        
        const memoLists = document.querySelectorAll('.memo-list');
        console.log('메모 리스트 수:', memoLists.length);
        
        memoLists.forEach((list, i) => {
            console.log(`리스트 ${i}:`, list.dataset.category, list.classList.contains('expanded'), 
                       list.style.display || 'default');
        });
    };

    // 간단한 수동 테스트 함수
    window.toggleFirstCategory = () => {
        const firstHeader = document.querySelector('.category-header');
        if (firstHeader) {
            console.log('첫 번째 카테고리 수동 클릭 테스트');
            firstHeader.click();
        } else {
            console.log('카테고리 헤더를 찾을 수 없습니다');
        }
    };

    // 앱 시작
    await initialize();
});