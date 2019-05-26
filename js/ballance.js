Ammo().then(function(Ammo) {
    //检测是否支持webgl
    if(! Detector.webgl){
        Detector.addGetWebGLMessage();
        document.getElementById('container').innerHTML="this browser is not supported by webgl";
    }
    // - Global variables -
    var DISABLE_DEACTIVATION = 4;
    var TRANSFORM_AUX = new Ammo.btTransform();
    var ZERO_QUATERNION = new THREE.Quaternion(0, 0, 0, 1);

    // Graphics variables
    var container, stats, speedometer;
    var camera, controls, scene, renderer;
    var terrainMesh, texture;
    var clock = new THREE.Clock();
    var materialDynamic, materialStatic, materialInteractive;

    // Physics variables
    var collisionConfiguration;
    var dispatcher;
    var broadphase;
    var solver;
    var physicsWorld;

    var syncList = [];
    var time = 0;
    var objectTimePeriod = 3;
    var timeNextSpawn = time + objectTimePeriod;
    var maxNumObjects = 30;

    // 键盘动作
    var actions = {};
    var keysActions = {
        "KeyW":'acceleration',
        "KeyS":'braking',
        "KeyA":'left',
        "KeyD":'right',
        "KeyI":'acceleration',
        "KeyK":'braking',
        "KeyJ":'left',
        "KeyL":'right',
    };

    // - Functions -

    function initGraphics() {

        container = document.getElementById( 'container' );
        speedometer = document.getElementById( 'speedometer' );

        scene = new THREE.Scene();

        camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 0.2, 2000 );
        camera.position.x = 0;
        camera.position.y = 20;
        camera.position.z = -20;
        camera.up.x = 0;
        camera.up.y = 1;
        camera.up.z = 0;
        camera.lookAt( new THREE.Vector3( 0, 0, 0 ) );
        controls = new THREE.OrbitControls( camera );

        renderer = new THREE.WebGLRenderer({antialias:true});
        renderer.setClearColor( 0xbfd1e5 );
        renderer.setPixelRatio( window.devicePixelRatio );
        renderer.setSize( window.innerWidth, window.innerHeight );

        var ambientLight = new THREE.AmbientLight( 0x404040 );
        scene.add( ambientLight );

        var dirLight = new THREE.DirectionalLight( 0xffffff, 1 );
        dirLight.position.set( 10, 10, 5 );
        scene.add( dirLight );

        //坐标轴可视化
        var axesHelper=new THREE.AxesHelper(50);
        scene.add(axesHelper);
        //高光材质
        materialDynamic = new THREE.MeshPhongMaterial( { color:0xfca400 } );
        materialStatic = new THREE.MeshPhongMaterial( { color:0x999999 } );
        materialInteractive=new THREE.MeshPhongMaterial( { color:0x990000 } );

        container.innerHTML = "";

        container.appendChild( renderer.domElement );
        //检测状态
        stats = new Stats();
        stats.domElement.style.position = 'absolute';
        stats.domElement.style.top = '0px';
        container.appendChild( stats.domElement );

        window.addEventListener( 'resize', onWindowResize, false );
        //添加键盘监听事件
        window.addEventListener( 'keydown', keydown);
        window.addEventListener( 'keyup', keyup);
    }

    function onWindowResize() {

        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();

        renderer.setSize( window.innerWidth, window.innerHeight );

    }

    function initPhysics() {

        // Physics configuration
        collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
        dispatcher = new Ammo.btCollisionDispatcher( collisionConfiguration );
        broadphase = new Ammo.btDbvtBroadphase();
        solver = new Ammo.btSequentialImpulseConstraintSolver();
        physicsWorld = new Ammo.btDiscreteDynamicsWorld( dispatcher, broadphase, solver, collisionConfiguration );
        physicsWorld.setGravity( new Ammo.btVector3( 0, -9.82, 0 ) );
    }

    /**
     * 主循环函数
     */
    function tick() {
        requestAnimationFrame( tick );
        var dt = clock.getDelta();
        //执行同步函数，键盘操作与图形、物理，图形与物理
        for (var i = 0; i < syncList.length; i++)
            syncList[i](dt);
        physicsWorld.stepSimulation( dt, 10 );
        controls.update( dt );
        renderer.render( scene, camera );
        /*console.log(camera.position);*/
        /*console.log(camera.lookAt);*/
        time += dt;
        //更新统计信息
        stats.update();
    }

    /**
     * 松开按键
     * @Param e 对应按键
     */
    function keyup(e) {
        if(keysActions[e.code]) {
            actions[keysActions[e.code]] = false;
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    }
    /**
     * 按下按键
     * @Param e 对应按键
     */
    function keydown(e) {
        if(keysActions[e.code]) {
            actions[keysActions[e.code]] = true;
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    }

    /**
     * 创建球体
     * @param pos 位置
     * @param quat 四元数
     * @param radius 半径
     * @param widthSegments 水平分段数
     * @param heightSegments 垂直分段数
     * @param mass 质量
     * @param friction 摩擦力
     */
    function createSphere(pos,quat,radius,widthSegments,heightSegments,mass,friction){

        var material=mass>0? materialDynamic:materialStatic;//选择颜色
        var shape=new THREE.SphereGeometry(radius,widthSegments,heightSegments);
        var geometry=new Ammo.btSphereShape(radius);

        //添加纹理
        var bumpScale=1;
        //TODO : 改成从网页中获取
        var textureWood=THREE.ImageUtils.loadTexture('./textures/Ball_Wood2.bmp');
        var textureStone=THREE.ImageUtils.loadTexture('./textures/Ball_Stone.bmp');
        var texturePaper=THREE.ImageUtils.loadTexture('./textures/Ball_Paper.bmp');
        var material_1=new THREE.MeshPhongMaterial({map:textureWood});
        var material_2=new THREE.MeshBasicMaterial({map:textureWood});
        var material_3=new THREE.MeshPhongMaterial({map:textureStone});
        var material_5=new THREE.MeshPhongMaterial({map:texturePaper});
        var material_6=new THREE.MeshBasicMaterial({map:texturePaper});

        if(!mass) mass = 0;
        if(!friction) friction = 1;

        //加速度
        const acceleratedSpeed=1;
        const maxSpeed=5;

        //创建 mesh 并加入 scene 中
        var mesh = new THREE.Mesh(shape, material_1);
        mesh.position.copy(pos);
        mesh.quaternion.copy(quat);
        scene.add( mesh );

        //记录位置、旋转的变化
        var transform = new Ammo.btTransform();
        transform.setIdentity();
        transform.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z));
        transform.setRotation(new Ammo.btQuaternion(quat.x, quat.y, quat.z, quat.w));
        var motionState = new Ammo.btDefaultMotionState(transform);

        //惯性
        var localInertia = new Ammo.btVector3(0, 0, 0);
        geometry.calculateLocalInertia(mass, localInertia);

        //创建刚体并加入 physicsWorld 中
        var rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, geometry, localInertia);
        var body = new Ammo.btRigidBody(rbInfo);
        body.setFriction(friction);
        body.setLinearVelocity(new Ammo.btVector3(0,0,0));
        physicsWorld.addRigidBody(body);

        //质量大于 0 时，考虑自身的位置、旋转变化，同时更新 mesh
        //控制球体的运动,同时保持球体与 camera 相对位置不变
        if (mass > 0) {
            body.setActivationState(DISABLE_DEACTIVATION);
            // Sync physics and graphics
            function sync(dt) {
                var ms = body.getMotionState();
                if (ms) {
                    ms.getWorldTransform(TRANSFORM_AUX);
                    var p = TRANSFORM_AUX.getOrigin();
                    var q = TRANSFORM_AUX.getRotation();
                    mesh.position.set(p.x(),p.y(),p.z());
                    mesh.quaternion.set(q.x(), q.y(), q.z(), q.w());
                }
                if(actions.acceleration){
                    let v=body.getLinearVelocity();
                    console.log(v.z());
                    if(v.z()+acceleratedSpeed>maxSpeed){
                        body.setLinearVelocity(new Ammo.btVector3(v.x(),v.y(),maxSpeed));
                        //保持球与摄像机相对位置不变
                        camera.position.x=mesh.position.x;
                        camera.position.z=mesh.position.z-20;
                        camera.up.x = 0;
                        camera.up.y = 1;
                        camera.up.z = 0;
                        camera.lookAt(new THREE.Vector3(mesh.position.x,mesh.position.y,mesh.position.z));
                        controls.target=mesh.position;
                    }
                    else {
                        body.setLinearVelocity(new Ammo.btVector3(v.x(),v.y(),v.z()+acceleratedSpeed));
                        //保持球与摄像机相对位置不变
                        camera.position.x=mesh.position.x;
                        camera.position.z=mesh.position.z-20;
                        camera.up.x = 0;
                        camera.up.y = 1;
                        camera.up.z = 0;
                        camera.lookAt(new THREE.Vector3(mesh.position.x,mesh.position.y,mesh.position.z));
                        controls.target=mesh.position;
                    }
                }
                if(actions.braking){
                    let v=body.getLinearVelocity();
                    if(v.z()-acceleratedSpeed<(0-maxSpeed)){
                        body.setLinearVelocity(new Ammo.btVector3(v.x(),v.y(),(0-maxSpeed)));
                        //保持球与摄像机相对位置不变
                        camera.position.x=mesh.position.x;
                        camera.position.z=mesh.position.z-20;
                        camera.up.x = 0;
                        camera.up.y = 1;
                        camera.up.z = 0;
                        camera.lookAt(new THREE.Vector3(mesh.position.x,mesh.position.y,mesh.position.z));
                        controls.target=mesh.position;
                    }
                    else {
                        body.setLinearVelocity(new Ammo.btVector3(v.x(),v.y(),v.z()-acceleratedSpeed));
                        //保持球与摄像机相对位置不变
                        camera.position.x=mesh.position.x;
                        camera.position.z=mesh.position.z-20;
                        camera.up.x = 0;
                        camera.up.y = 1;
                        camera.up.z = 0;
                        camera.lookAt(new THREE.Vector3(mesh.position.x,mesh.position.y,mesh.position.z));
                        controls.target=mesh.position;
                    }
                }
                if(actions.left){
                    let v=body.getLinearVelocity();
                    if(v.x()+acceleratedSpeed>maxSpeed){
                        body.setLinearVelocity(new Ammo.btVector3(maxSpeed,v.y(),v.z()));
                        //保持球与摄像机相对位置不变
                        camera.position.x=mesh.position.x;
                        camera.position.z=mesh.position.z-20;
                        camera.up.x = 0;
                        camera.up.y = 1;
                        camera.up.z = 0;
                        camera.lookAt(new THREE.Vector3(mesh.position.x,mesh.position.y,mesh.position.z));
                        controls.target=mesh.position;
                    }
                    else{
                        body.setLinearVelocity(new Ammo.btVector3(v.x()+acceleratedSpeed,v.y(),v.z()));
                        //保持球与摄像机相对位置不变
                        camera.position.x=mesh.position.x;
                        camera.position.z=mesh.position.z-20;
                        camera.up.x = 0;
                        camera.up.y = 1;
                        camera.up.z = 0;
                        camera.lookAt(new THREE.Vector3(mesh.position.x,mesh.position.y,mesh.position.z));
                        controls.target=mesh.position;
                    }
                }
                else{
                    if(actions.right){
                        let v=body.getLinearVelocity();
                        if(v.x()-acceleratedSpeed<(0-maxSpeed)){
                            body.setLinearVelocity(new Ammo.btVector3((0-maxSpeed),v.y(),v.z()));
                            //保持球与摄像机相对位置不变
                            camera.position.x=mesh.position.x;
                            camera.position.z=mesh.position.z-20;
                            camera.up.x = 0;
                            camera.up.y = 1;
                            camera.up.z = 0;
                            camera.lookAt(new THREE.Vector3(mesh.position.x,mesh.position.y,mesh.position.z));
                            controls.target=mesh.position;
                        }
                        else{
                            body.setLinearVelocity(new Ammo.btVector3(v.x()-acceleratedSpeed,v.y(),v.z()));
                            //保持球与摄像机相对位置不变
                            camera.position.x=mesh.position.x;
                            camera.position.z=mesh.position.z-20;
                            camera.up.x = 0;
                            camera.up.y = 1;
                            camera.up.z = 0;
                            camera.lookAt(new THREE.Vector3(mesh.position.x,mesh.position.y,mesh.position.z));
                            controls.target=mesh.position;
                        }
                    }
                    else {
                        /*console.log(camera.position);*/
                        /*console.log(camera.lookAt);*/
                        camera.position.x=mesh.position.x;
                        camera.position.z=mesh.position.z-20;
                        camera.up.x = 0;
                        camera.up.y = 1;
                        camera.up.z = 0;
                        camera.lookAt(new THREE.Vector3(mesh.position.x,mesh.position.y,mesh.position.z));
                        controls.target=mesh.position;
                    }
                }
            }

            syncList.push(sync);
        }
    }

    /**
     * 创建立方体
     * @param pos 位置
     * @param quat 四元数
     * @param w 宽
     * @param l 长
     * @param h 高
     * @param mass 质量
     * @param friction 摩擦力
     */
    function createBox(pos, quat, w, l, h, mass, friction) {
        var material = mass > 0 ? materialDynamic : materialStatic;//材质
        var shape = new THREE.BoxGeometry(w, l, h, 1, 1, 1);
        var geometry = new Ammo.btBoxShape(new Ammo.btVector3(w * 0.5, l * 0.5, h * 0.5));

        if(!mass) mass = 0;
        if(!friction) friction = 1;

        var mesh = new THREE.Mesh(shape, material);
        mesh.position.copy(pos);
        mesh.quaternion.copy(quat);
        scene.add( mesh );

        var transform = new Ammo.btTransform();
        transform.setIdentity();
        transform.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z));
        transform.setRotation(new Ammo.btQuaternion(quat.x, quat.y, quat.z, quat.w));
        var motionState = new Ammo.btDefaultMotionState(transform);

        var localInertia = new Ammo.btVector3(0, 0, 0);
        geometry.calculateLocalInertia(mass, localInertia);

        var rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, geometry, localInertia);
        var body = new Ammo.btRigidBody(rbInfo);

        body.setFriction(friction);
        //body.setRestitution(.9);
        //body.setDamping(0.2, 0.2);

        physicsWorld.addRigidBody( body );

        if (mass > 0) {
            body.setActivationState(DISABLE_DEACTIVATION);
            // Sync physics and graphics
            function sync(dt) {
                var ms = body.getMotionState();
                if (ms) {
                    ms.getWorldTransform(TRANSFORM_AUX);
                    var p = TRANSFORM_AUX.getOrigin();
                    var q = TRANSFORM_AUX.getRotation();
                    mesh.position.set(p.x(), p.y(), p.z());
                    mesh.quaternion.set(q.x(), q.y(), q.z(), q.w());
                }
            }

            syncList.push(sync);
        }
    }

    function createObjects() {

        //创建地图
        createBox(new THREE.Vector3(0, -0.5, 0), ZERO_QUATERNION, 75, 1, 75, 0, 2);

        /*var quaternion = new THREE.Quaternion(0, 0, 0, 1);
        quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 18);
        createBox(new THREE.Vector3(0, -1.5, 0), quaternion, 8, 4, 10, 0);*/

        //创建球体
        createSphere(new THREE.Vector3(0,2,0),ZERO_QUATERNION,1,32,32,5,1000);
    }

    // - Init -
    initGraphics();
    initPhysics();
    createObjects();
    tick();
});