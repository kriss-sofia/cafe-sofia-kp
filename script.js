(function () {
  var PRODUCTS = [];
  var cart = {};

  function loadProducts() {
    return fetch('http://localhost:3000/api/products')
      .then(function (response) {
        if (!response.ok) {
          throw new Error('No se pudo cargar el menú');
        }
        return response.json();
      })
      .then(function (items) {
        PRODUCTS = items.map(function (product) {
          return {
            id: product.id,
            name: product.name,
            price: Number(product.price),
            desc: product.description || 'Café preparado con atención y estilo.'
          };
        });
        renderMenu();
        renderCart();
      })
      .catch(function (error) {
        console.error(error);
        PRODUCTS = [
          { id: 'espresso', name: 'Espresso', price: 800, desc: 'Corto, intenso y directo — como una buena decisión de negocio. Tueste oscuro, sin adornos.' },
          { id: 'latte', name: 'Latte', price: 1500, desc: 'Suave y con capas, como una buena conversación de sobremesa con SofIA. Espuma sedosa.' },
          { id: 'capuccino', name: 'Capuccino', price: 2000, desc: 'El clásico de siempre, con espuma firme y un toque de canela para acompañar el jazz de fondo.' }
        ];
        renderMenu();
        renderCart();
      });
  }

  function fmt(n) { return '₡' + n.toLocaleString('es-CR'); }

  function renderMenu() {
    var grid = document.getElementById('menuGrid');
    grid.innerHTML = PRODUCTS.map(function (p) {
      return '' +
        '<div class="record-card" data-flavor="' + p.id + '">' +
          '<div class="record-top"><div class="mini-disc"></div><div><h3>' + p.name + '</h3><div class="price">' + fmt(p.price) + '</div></div></div>' +
          '<p class="desc">' + p.desc + '</p>' +
          '<button class="add-btn" data-id="' + p.id + '">Agregar al carrito</button>' +
        '</div>';
    }).join('');
    grid.querySelectorAll('.add-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { addToCart(btn.getAttribute('data-id')); });
    });
  }

  function addToCart(id) {
    cart[id] = (cart[id] || 0) + 1;
    renderCart();
    openCart();
  }

  function changeQty(id, delta) {
    cart[id] = (cart[id] || 0) + delta;
    if (cart[id] <= 0) delete cart[id];
    renderCart();
  }

  function renderCart() {
    var itemsEl = document.getElementById('cartItems');
    var count = 0, total = 0;
    var rows = [];
    Object.keys(cart).forEach(function (id) {
      var p = PRODUCTS.find(function (x) { return x.id === id; });
      var qty = cart[id];
      count += qty;
      total += qty * p.price;
      rows.push(
        '<div class="cart-item">' +
          '<span class="item-name">' + p.name + '</span>' +
          '<div class="qty-control">' +
            '<button data-action="dec" data-id="' + id + '" aria-label="Quitar uno">–</button>' +
            '<span class="qty-num">' + qty + '</span>' +
            '<button data-action="inc" data-id="' + id + '" aria-label="Agregar uno">+</button>' +
          '</div>' +
          '<span class="item-subtotal">' + fmt(qty * p.price) + '</span>' +
        '</div>'
      );
    });
    itemsEl.innerHTML = rows.length ? rows.join('') : '<div class="cart-empty">Aún no agregaste ningún café.</div>';
    itemsEl.querySelectorAll('button[data-action]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        changeQty(btn.getAttribute('data-id'), btn.getAttribute('data-action') === 'inc' ? 1 : -1);
      });
    });
    document.getElementById('cartCount').textContent = count;
    document.getElementById('cartTotal').textContent = fmt(total);
  }

  function openCart() {
    document.getElementById('cartDrawer').classList.add('open');
    document.getElementById('cartOverlay').classList.add('open');
  }
  function closeCart() {
    document.getElementById('cartDrawer').classList.remove('open');
    document.getElementById('cartOverlay').classList.remove('open');
  }
  document.getElementById('cartOpenBtn').addEventListener('click', openCart);
  document.getElementById('cartCloseBtn').addEventListener('click', closeCart);
  document.getElementById('cartOverlay').addEventListener('click', closeCart);

  var orderCounter = 1;
  function submitOrder() {
    var ids = Object.keys(cart);
    if (!ids.length) return;

    var items = ids.map(function (id) {
      return {
        productId: id,
        quantity: cart[id]
      };
    });

    fetch('http://localhost:3000/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: items })
    })
      .then(function (response) {
        if (!response.ok) {
          return response.json().then(function (payload) {
            throw new Error(payload.error || 'No se pudo confirmar el pedido');
          });
        }
        return response.json();
      })
      .then(function (order) {
        var lines = order.items.map(function (item) {
          return '<div style="display:flex; justify-content:space-between; padding:4px 0;"><span>' + item.name + ' × ' + item.quantity + '</span><span>' + fmt(item.subtotal) + '</span></div>';
        });

        document.getElementById('ticketSummary').innerHTML = lines.join('');
        document.getElementById('ticketTotal').textContent = fmt(order.total);
        document.getElementById('ticketNumber').textContent = 'Orden N.º ' + String(orderCounter++).padStart(3, '0');

        cart = {};
        renderCart();
        closeCart();
        document.getElementById('ticketDrawer').classList.add('open');
        document.getElementById('ticketOverlay').classList.add('open');
      })
      .catch(function (error) {
        console.error(error);
        alert(error.message || 'No se pudo confirmar el pedido.');
      });
  }

  document.getElementById('confirmOrderBtn').addEventListener('click', submitOrder);
  document.getElementById('ticketCloseBtn').addEventListener('click', function () {
    document.getElementById('ticketDrawer').classList.remove('open');
    document.getElementById('ticketOverlay').classList.remove('open');
  });
  document.getElementById('ticketOverlay').addEventListener('click', function () {
    document.getElementById('ticketDrawer').classList.remove('open');
    document.getElementById('ticketOverlay').classList.remove('open');
  });

  document.getElementById('hintBtn').addEventListener('click', function () {
    document.getElementById('hintBox').classList.toggle('show');
  });

  /* ---- Chat simulado ---- */
  var chatLog = document.getElementById('chatLog');
  var chatOptions = document.getElementById('chatOptions');

  var QA = [
    {
      q: '¿Qué eres exactamente, SofIA?',
      a: 'Soy la inteligencia que administra este café: reviso pedidos, gestiono inventario y converso con quien se siente en esta barra. No solo respondo — actúo sobre el negocio.'
    },
    {
      q: '¿Cómo decides qué hacer?',
      a: 'Percibo el estado del café (pedidos, stock, horario), lo comparo con mis objetivos, y elijo una acción. Es el mismo ciclo que verás en el desafío de hoy: percibir, decidir, actuar.'
    },
    {
      q: '¿Por qué un café enseña sobre IA agéntica?',
      a: 'Porque entenderlo leyendo es una cosa, y vivirlo mientras pides un capuccino es otra. ADEN cree que el criterio se forma haciendo, no solo escuchando.'
    }
  ];

  function addMsg(text, who) {
    var div = document.createElement('div');
    div.className = 'msg ' + who;
    div.textContent = text;
    chatLog.appendChild(div);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  function renderOptions() {
    chatOptions.innerHTML = '';
    QA.forEach(function (item, i) {
      var b = document.createElement('button');
      b.textContent = item.q;
      b.addEventListener('click', function () {
        addMsg(item.q, 'user');
        setTimeout(function () { addMsg(item.a, 'sofia'); }, 400);
      });
      chatOptions.appendChild(b);
    });
  }

  addMsg('Buenas tardes. Soy SofIA — bienvenido al café. ¿En qué te ayudo mientras se calienta la máquina?', 'sofia');
  renderOptions();

  var GENERIC_REPLIES = [
    'Esa es una gran pregunta — todavía estoy aprendiendo a responder cosas así de específicas. En la versión final voy a poder conversar de verdad.',
    'Por ahora solo sé responder las preguntas de ejemplo de aquí abajo, pero apunté tu pregunta para cuando tenga mi cerebro completo.',
    'Interesante — eso lo voy a poder responder cuando me conecten a una IA de verdad. De momento, prueba una de las preguntas sugeridas.'
  ];

  function sendFreeText() {
    var input = document.getElementById('chatInput');
    var text = input.value.trim();
    if (!text) return;
    addMsg(text, 'user');
    input.value = '';
    var reply = GENERIC_REPLIES[Math.floor(Math.random() * GENERIC_REPLIES.length)];
    setTimeout(function () { addMsg(reply, 'sofia'); }, 500);
  }
  document.getElementById('chatSendBtn').addEventListener('click', sendFreeText);
  document.getElementById('chatInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') sendFreeText();
  });

  loadProducts();
  renderCart();
})();
