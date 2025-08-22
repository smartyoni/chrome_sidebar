document.addEventListener('DOMContentLoaded', async () => {
    // DOM 요소 가져오기
    const memoForm = document.getElementById('memo-form');
    const memoInput = document.getElementById('memo-input');
    const memoList = document.getElementById('memo-list');
    const tabContainer = document.querySelector('.tabs');
    const addTabBtn = document.getElementById('add-tab-btn');
    const viewModal = document.getElementById('view-modal');
    const editModal = document.getElementById('edit-modal');
    const closeModalBtns = document.querySelectorAll('.close-btn');
    const editForm = document.getElementById('edit-form');
    const datetimeElement = document.getElementById('current-datetime');
    const listHeader = document.getElementById('list-header');
    const listHeaderTitle = document.getElementById('list-header-title');
    const listHeaderActions = document.getElementById('list-header-actions');
    const confirmModal = document.getElementById('confirm-modal');
    const confirmMessage = document.getElementById('confirm-message');
    const confirmYesBtn = document.getElementById('confirm-yes');
    const confirmNoBtn = document.getElementById('confirm-no');

    let currentCategory = 'all';
    let memoTabs = [];
    let memos = [];
    let currentOpenMemoId = null;

    // 커스텀 확인 창 함수
    const showCustomConfirm = (message) => {
        return new Promise((resolve) => {
            confirmMessage.textContent = message;
            confirmModal.style.display = 'block';
            const yesHandler = () => {
                confirmModal.style.display = 'none';
                confirmYesBtn.removeEventListener('click', yesHandler);
                confirmNoBtn.removeEventListener('click', noHandler);
                resolve(true);
            };
            const noHandler = () => {
                confirmModal.style.display = 'none';
                confirmYesBtn.removeEventListener('click', yesHandler);
                confirmNoBtn.removeEventListener('click', noHandler);
                resolve(false);
            };
            confirmYesBtn.addEventListener('click', yesHandler);
            confirmNoBtn.addEventListener('click', noHandler);
        });
    };

    // 팝업 드래그 함수
    const makeDraggable = (modalContent, handle) => {
        let isDragging = false, offsetX, offsetY;
        handle.addEventListener('mousedown', (e) => {
            isDragging = true; const rect = modalContent.getBoundingClientRect(); modalContent.style.transform = 'none';
            modalContent.style.left = `${rect.left}px`; modalContent.style.top = `${rect.top}px`;
            offsetX = e.clientX - rect.left; offsetY = e.clientY - rect.top;
            document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp);
        });
        function onMouseMove(e) { if (!isDragging) return; modalContent.style.left = `${e.clientX - offsetX}px`; modalContent.style.top = `${e.clientY - offsetY}px`; }
        function onMouseUp() { isDragging = false; document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); }
    };

    // URL 링크 변환 함수
    const linkify = (plainText) => {
        if (!plainText) return ''; let linkedText = plainText;
        const markdownLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
        linkedText = linkedText.replace(markdownLinkRegex, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
        const urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])|(\bwww\.[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
        linkedText = linkedText.replace(urlRegex, (url) => {
            if (new RegExp(`href="https?:\/\/${url.replace(/^https?:\/\//, '')}"`).test(linkedText)) return url;
            let href = url; if (!href.match(/^[a-zA-Z]+:\/\//)) href = 'http://' + href;
            return `<a href="${href}" target="_blank" rel="noopener noreferrer">${url}</a>`;
        });
        return linkedText;
    };

    // 랜덤 색상 생성 함수
    const getRandomColor = () => {
        const rainbowColors = ['#ff7675', '#fab1a0', '#fdcb6e', '#55efc4', '#74b9ff', '#a29bfe', '#fd79a8'];
        return rainbowColors[Math.floor(Math.random() * rainbowColors.length)];
    };

    // 데이터 로드/저장 함수
    const loadData = async () => {
        const result = await chrome.storage.local.get(['memos', 'memoTabs']);
        memos = result.memos || [];
        memoTabs = result.memoTabs || [{ name: '계약', color: '#3498db', icon: '📄' }, { name: '광고', color: '#e74c3c', icon: '📢' }, { name: '기타', color: '#95a5a6', icon: '📌' }];
    };
    const saveData = async () => {
        await chrome.storage.local.set({ memos, memoTabs });
    };
    
    // UI 렌더링 함수들
    const renderTabs = () => {
        tabContainer.innerHTML = ''; const allTab = document.createElement('button'); allTab.className = 'tab-btn'; allTab.dataset.category = 'all'; allTab.textContent = '전체'; tabContainer.appendChild(allTab);
        memoTabs.forEach(tab => {
            const tabBtn = document.createElement('button'); tabBtn.className = 'tab-btn'; tabBtn.dataset.category = tab.name; tabBtn.textContent = tab.name;
            tabBtn.style.backgroundColor = tab.color + '20'; tabBtn.style.borderColor = tab.color;
            tabContainer.appendChild(tabBtn);
        });
        const activeTab = document.querySelector(`.tab-btn[data-category="${currentCategory}"]`); if (activeTab) activeTab.classList.add('active');
    };
    const renderListHeader = () => {
        listHeaderActions.innerHTML = '';
        if (currentCategory === 'all' || !currentCategory) { listHeaderTitle.textContent = '전체 메모'; } 
        else {
            listHeaderTitle.textContent = currentCategory;
            const editBtn = document.createElement('button'); editBtn.className = 'edit-btn'; editBtn.textContent = '이름 수정'; editBtn.onclick = handleEditTabName;
            const deleteBtn = document.createElement('button'); deleteBtn.className = 'delete-btn'; deleteBtn.textContent = '탭 삭제'; deleteBtn.onclick = handleDeleteTab;
            listHeaderActions.appendChild(editBtn); listHeaderActions.appendChild(deleteBtn);
        }
    };
    const renderEditCategoryDropdown = () => {
        const selectElement = document.getElementById('edit-category'); selectElement.innerHTML = '';
        memoTabs.forEach(tab => { const option = document.createElement('option'); option.value = tab.name; option.textContent = tab.name; selectElement.appendChild(option); });
    };
    const renderMemos = () => {
        const filteredMemos = memos.filter(memo => currentCategory === 'all' || memo.category === currentCategory);
        filteredMemos.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
        memoList.innerHTML = '';
        filteredMemos.forEach(memo => {
            const li = document.createElement('li'); li.className = memo.isPinned ? 'pinned' : ''; li.dataset.id = memo.id;
            li.innerHTML = `<button class="pin-btn ${memo.isPinned ? 'pinned' : ''}" title="고정">${memo.isPinned ? '📌' : '📍'}</button><span class="memo-title">${memo.title}</span>`;
            memoList.appendChild(li);
        });
    };
    
    // 이벤트 리스너들
    addTabBtn.addEventListener('click', async () => {
        const newTabName = prompt("새로운 카테고리 이름을 입력하세요:", `새 카테고리 ${memoTabs.length + 1}`);
        if (newTabName && !memoTabs.find(tab => tab.name === newTabName)) {
            memoTabs.push({ name: newTabName, color: getRandomColor(), icon: '📑' });
            await saveData(); renderTabs(); renderEditCategoryDropdown();
        } else if (newTabName) { alert("이미 존재하는 이름입니다."); }
    });

    tabContainer.addEventListener('click', (e) => {
        const tabBtn = e.target.closest('.tab-btn');
        if (tabBtn) { currentCategory = tabBtn.dataset.category; renderTabs(); renderMemos(); renderListHeader(); }
    });
    
    const handleEditTabName = async () => {
        const oldTabName = currentCategory;
        const newTabName = prompt("새로운 카테고리 이름을 입력하세요:", oldTabName);
        if (newTabName && newTabName !== oldTabName && !memoTabs.find(t => t.name === newTabName)) {
            const tab = memoTabs.find(t => t.name === oldTabName); if (tab) tab.name = newTabName;
            memos.forEach(memo => { if (memo.category === oldTabName) { memo.category = newTabName; } });
            await saveData(); currentCategory = newTabName; renderTabs(); renderEditCategoryDropdown(); renderMemos(); renderListHeader();
        } else if (newTabName && newTabName !== oldTabName) { alert("이미 존재하는 이름입니다."); }
    };

    const handleDeleteTab = async () => {
        const tabNameToDelete = currentCategory;
        const confirmed = await showCustomConfirm(`'${tabNameToDelete}' 탭을 삭제하시겠습니까?\n이 탭에 포함된 모든 메모도 함께 삭제됩니다.`);
        if (confirmed) {
            memos = memos.filter(memo => memo.category !== tabNameToDelete);
            memoTabs = memoTabs.filter(tab => tab.name !== tabNameToDelete);
            await saveData(); currentCategory = 'all'; renderTabs(); renderEditCategoryDropdown(); renderMemos(); renderListHeader();
        }
    };
    
    memoForm.addEventListener('submit', async (e) => {
        e.preventDefault(); const fullText = memoInput.value.trim();
        if (fullText) {
            const lines = fullText.split('\n'); const title = lines[0]; const content = fullText;
            const categoryToSave = (currentCategory === 'all' || !memoTabs.find(t => t.name === currentCategory)) ? (memoTabs[0]?.name || '기타') : currentCategory;
            const newMemo = { id: Date.now().toString(), title, content, isPinned: false, category: categoryToSave };
            memos.push(newMemo); await saveData(); renderMemos(); memoForm.reset();
        }
    });

    memoList.addEventListener('click', (e) => {
        const li = e.target.closest('li'); if (!li) return;
        const memoId = li.dataset.id;
        const memo = memos.find(m => String(m.id) === memoId); if (!memo) return;
        const pinBtn = e.target.closest('.pin-btn');
        if (pinBtn) { memo.isPinned = !memo.isPinned; saveData(); renderMemos(); return; }
        
        currentOpenMemoId = memo.id;
        viewModal.querySelector('.modal-content').style.cssText = '';
        document.getElementById('view-title').textContent = memo.title;
        document.getElementById('view-content').innerHTML = linkify(memo.content);
        
        const modalActions = viewModal.querySelector('.modal-actions');
        modalActions.innerHTML = `
            <button class="modal-btn copy-btn" data-action="copy">복사</button>
            <button class="modal-btn edit-btn" data-action="edit">수정</button>
            ${!memo.isPinned ? `<button class="modal-btn delete-btn" data-action="delete">삭제</button>` : ''}
        `;
        viewModal.style.display = 'block';
    });

    viewModal.addEventListener('click', async (e) => {
        const target = e.target.closest('.modal-btn'); if (!target) return;
        const action = target.dataset.action;
        const memo = memos.find(m => m.id === currentOpenMemoId); if (!memo) return;
        switch (action) {
            case 'copy':
                const content = document.getElementById('view-content').textContent;
                navigator.clipboard.writeText(content).then(() => {
                    target.textContent = '복사 완료!'; setTimeout(() => { target.textContent = '복사'; }, 1500);
                });
                break;
            case 'edit':
                viewModal.style.display = 'none';
                editModal.querySelector('.modal-content').style.cssText = '';
                document.getElementById('edit-id').value = memo.id;
                document.getElementById('edit-input').value = memo.content;
                renderEditCategoryDropdown();
                document.getElementById('edit-category').value = memo.category || (memoTabs[0]?.name || '');
                editModal.style.display = 'block';
                break;
            case 'delete':
                viewModal.style.display = 'none';
                const confirmed = await showCustomConfirm(`'${memo.title}' 메모를 정말 삭제하시겠습니까?`);
                if (confirmed) {
                    memos = memos.filter(m => m.id !== memo.id);
                    await saveData();
                    renderMemos();
                }
                break;
        }
    });
    
    closeModalBtns.forEach(btn => {
        btn.onclick = () => { viewModal.style.display = 'none'; editModal.style.display = 'none'; };
    });
    window.onclick = (event) => {
        if (event.target == viewModal || event.target == editModal) {
            viewModal.style.display = 'none'; editModal.style.display = 'none';
        }
    };

    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-id').value;
        const fullText = document.getElementById('edit-input').value.trim();
        const newCategory = document.getElementById('edit-category').value;
        const lines = fullText.split('\n'); const newTitle = lines[0]; const newContent = fullText;
        const memo = memos.find(m => String(m.id) === id);
        if (memo) { memo.title = newTitle; memo.content = newContent; memo.category = newCategory; }
        await saveData();
        editModal.style.display = 'none';
        renderMemos();
        renderListHeader();
    });

    new Sortable(memoList, {
        animation: 150, ghostClass: 'sortable-ghost',
        onMove: (evt) => evt.dragged.classList.contains('pinned') === evt.related.classList.contains('pinned'),
        onEnd: async (evt) => {
            const visibleItems = memos.filter(memo => currentCategory === 'all' || memo.category === currentCategory);
            const [movedItem] = visibleItems.splice(evt.oldIndex, 1);
            visibleItems.splice(evt.newIndex, 0, movedItem);
            const hiddenItems = memos.filter(memo => currentCategory !== 'all' && memo.category !== currentCategory);
            memos = [...hiddenItems, ...visibleItems];
            await saveData();
            renderMemos();
        },
    });

    new Sortable(tabContainer, {
        animation: 150, filter: '.tab-btn[data-category="all"]',
        onEnd: async (evt) => {
            const [movedTab] = memoTabs.splice(evt.oldIndex - 1, 1);
            memoTabs.splice(evt.newIndex - 1, 0, movedTab);
            await saveData();
            renderTabs();
        }
    });

    function updateTime() {
        const now = new Date(); const days = ['일', '월', '화', '수', '목', '금', '토'];
        const year = now.getFullYear(); const month = now.getMonth() + 1; const day = now.getDate();
        const dayOfWeek = days[now.getDay()]; let hours = now.getHours();
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? '오후' : '오전'; hours = hours % 12; hours = hours ? hours : 12;
        const formattedDatetime = `${year}년 ${month}월 ${day}일 (${dayOfWeek}) ${ampm} ${hours}:${minutes}`;
        datetimeElement.textContent = formattedDatetime;
    }
    
    const initialize = async () => {
        makeDraggable(document.querySelector('#view-modal .modal-content'), document.querySelector('#view-modal .modal-header'));
        makeDraggable(document.querySelector('#edit-modal .modal-content'), document.querySelector('#edit-modal .modal-header'));
        
        await loadData();
        if (memoTabs.length > 0 && typeof memoTabs[0] === 'string') {
            memoTabs = memoTabs.map(tabName => ({ name: tabName, color: getRandomColor(), icon: '📑' }));
            await saveData();
        }
        
        renderTabs();
        renderEditCategoryDropdown();
        renderMemos();
        renderListHeader();
        updateTime();
        setInterval(updateTime, 1000);
    };

    await initialize();
});