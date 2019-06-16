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
    var materialDynamic, materialStatic, materialInteractive,materialCylinder;

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
    var lastObjectInMap=new Map();//地图中最后一块元素

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
        "ArrowLeft":'cylinderLeft',
        "ArrowRight":'cylinderRight'
    };

    // - Functions -

    function initGraphics() {

        container = document.getElementById( 'container' );
        speedometer = document.getElementById( 'speedometer' );

        scene = new THREE.Scene();

        camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 0.2, 2000 );
        camera.position.x = 0;
        camera.position.y = 10;
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

        //背景
        scene.background=new THREE.CubeTextureLoader()
            .setPath('./textures/')
            .load(['Sky_A_px.jpg','Sky_A_nx.jpg','Sky_A_py.jpg','Sky_A_ny.jpg','Sky_A_pz.jpg','Sky_A_nz.jpg']);


        //光源
        var dirLight = new THREE.DirectionalLight( 0xffffff, 1 );
        dirLight.position.set( -100, 100, 0 );
        scene.add( dirLight );

        //坐标轴可视化
        var axesHelper=new THREE.AxesHelper(50);
        //scene.add(axesHelper);
        //高光材质
        materialDynamic = new THREE.MeshPhongMaterial( { color:0xfca400 } );
        materialStatic = new THREE.MeshPhongMaterial( { color:0x999999 } );
        materialInteractive=new THREE.MeshPhongMaterial( { color:0x990000 } );
        materialCylinder=new THREE.MeshPhongMaterial( { color:0xc0c0c0 } );

        container.innerHTML = "";

        container.appendChild( renderer.domElement );

        /*//加载地图
        var mtlLoader=new THREE.MTLLoader();
        mtlLoader.setPath('./textures/');
        mtlLoader.load('level1-6.mtl',function (material) {
            var objLoader=new THREE.OBJLoader();
            objLoader.setPath('./textures/');
            objLoader.load('level1-6.obj',function (object) {
                //将模型缩放并添加到场景当中
                object.scale.set(0.4,0.4,0.4);
                scene.add(object);

                //加入 physicsWorld
                var transform = new Ammo.btTransform();
                transform.setIdentity();
                transform.setOrigin(new Ammo.btVector3(0, 0, 0));
                transform.setRotation(new Ammo.btQuaternion(0, 0, 0, 1));
                var motionState = new Ammo.btDefaultMotionState(transform);

                var localInertia = new Ammo.btVector3(0, 0, 0);
                object.calculateLocalInertia(0, localInertia);

                var rbInfo = new Ammo.btRigidBodyConstructionInfo(0, motionState, geometry, localInertia);
                var body = new Ammo.btRigidBody(rbInfo);

                body.setFriction(1);
                //body.setRestitution(.9);
                //body.setDamping(0.2, 0.2);

                physicsWorld.addRigidBody( body );

            }, function (error) {
                console.log(error);
            });
        });*/

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
        const acceleratedSpeed=0.1;
        //最大速度
        const maxSpeed=7;

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
                    if(v.z()+acceleratedSpeed>maxSpeed){
                        body.setLinearVelocity(new Ammo.btVector3(v.x(),v.y(),maxSpeed));
                        //保持球与摄像机相对位置不变
                        camera.position.x=mesh.position.x;
                        camera.position.z=mesh.position.z-10;
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
                        camera.position.z=mesh.position.z-10;
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
                        camera.position.z=mesh.position.z-10;
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
                        camera.position.z=mesh.position.z-10;
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
                        camera.position.z=mesh.position.z-10;
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
                        camera.position.z=mesh.position.z-10;
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
                            camera.position.z=mesh.position.z-10;
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
                            camera.position.z=mesh.position.z-10;
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
                        camera.position.z=mesh.position.z-10;
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
     * @param mass 质量
     * @param friction 摩擦力
     * @param height 高度
     * @param depth 长
     * @return {Raycaster.params.Mesh | Mesh}
     * @param material 材料
     */
    function createBox(pos, quat, w, height, depth, mass, friction,material) {
        //console.log(!material);
        if(!material){
            material = mass > 0 ? materialDynamic : materialStatic;//材质
        }
        var shape = new THREE.BoxGeometry(w, height, depth, 1, 1, 1);
        var geometry = new Ammo.btBoxShape(new Ammo.btVector3(w * 0.5, height * 0.5, depth * 0.5));

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
        return mesh;
    }
    function createCylinder(pos,quat,radiusTop,radiusBottom,height,mass,friction) {
        var material = new THREE.MeshPhongMaterial({color: 0xc0c0c0});
        var geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 64);
        var btGeometry = new Ammo.btCylinderShape(new Ammo.btVector3(radiusTop, height, radiusBottom));
        var cylinder = new THREE.Mesh(geometry, material);
        cylinder.position.copy(pos);
        cylinder.quaternion.copy(quat);
        scene.add(cylinder);

        //创建刚体，加入 physicsWorld
        if (!mass) mass = 0;
        if (!friction) friction = 1;
        var transform = new Ammo.btTransform();
        transform.setIdentity();
        transform.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z));
        transform.setRotation(new Ammo.btQuaternion(quat.x, quat.y, quat.z, quat.w));
        var motionState = new Ammo.btDefaultMotionState(transform);

        var localInertia = new Ammo.btVector3(0, 0, 0);
        btGeometry.calculateLocalInertia(mass, localInertia);

        var rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, btGeometry, localInertia);
        var body = new Ammo.btRigidBody(rbInfo);

        //body.setFriction(friction);
        //body.setRestitution(.9);
        //body.setDamping(0.2, 0.2);

        physicsWorld.addRigidBody(body);
    }

    /**
     * 创建障碍物----两个木箱
     * @param pos 木箱需要放的位置
     */
    function createBarrier(pos) {
        var textureCube=new THREE.TextureLoader().load('./textures/E_Holzbeschlag.bmp');
        var newMaterial=new THREE.MeshPhongMaterial({map:textureCube});

        var quaternion = new THREE.Quaternion(0, 0, 0, 1);
        quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 5);
        createBox(new THREE.Vector3(pos.x+0.1,pos.y+1.7,pos.z),quaternion,1.7,1.7,1.7,1,1,newMaterial);
        quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 4);
        createBox(new THREE.Vector3(pos.x,pos.y+3.4,pos.z),quaternion,1.7,1.7,1.7,1,1,newMaterial);
    }
    function createMap(){
        //连续的 floor
        var floorNumber=10;
        var textureCube=new THREE.TextureLoader().load('./textures/Brick.bmp');
        var newMaterial=new THREE.MeshPhongMaterial({map:textureCube});
        for(let i=0;i<floorNumber;i++){
            createBox(new THREE.Vector3(0,0,2*i),ZERO_QUATERNION,2,2,2,0,2,newMaterial);
            lastObjectInMap.set('type','Box');
            lastObjectInMap.set('position',[0,0,2*i]);
        }
        console.log(lastObjectInMap);
        //两根圆柱
        var cylinderNumber=10;
        var quaternion = new THREE.Quaternion(0, 0, 0, 1);
        quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
        for(let i=0;i<cylinderNumber;i++){
            createCylinder(new THREE.Vector3(-0.85,0.85,lastObjectInMap.get('position')[2]+2),quaternion,0.15,0.15,2,0,1);
            createCylinder(new THREE.Vector3(0.85,0.85,lastObjectInMap.get('position')[2]+2),quaternion,0.15,0.15,2,0,1);
            lastObjectInMap.set('type','CylinderDouble');
            lastObjectInMap.set('position',[0,0,lastObjectInMap.get('position')[2]+2]);
        }
        //一根圆柱
        cylinderNumber=5;
        var y=-1.38+2.12*Math.sin(Math.acos(0.85/2.15));
        for(let i=0;i<cylinderNumber;i++){
            createCylinder(new THREE.Vector3(0,y,lastObjectInMap.get('position')[2]+2),quaternion,0.15,0.15,2,0,1);
            lastObjectInMap.set('type','CylinderSingle');
            lastObjectInMap.set('position',[0,0,lastObjectInMap.get('position')[2]+2]);
        }
        //两根圆柱
        cylinderNumber=10;
        for(let i=0;i<cylinderNumber;i++){
            createCylinder(new THREE.Vector3(-0.85,0.85,lastObjectInMap.get('position')[2]+2),quaternion,0.15,0.15,2,0,1);
            createCylinder(new THREE.Vector3(0.85,0.85,lastObjectInMap.get('position')[2]+2),quaternion,0.15,0.15,2,0,1);
            lastObjectInMap.set('type','CylinderDouble');
            lastObjectInMap.set('position',[0,0,lastObjectInMap.get('position')[2]+2]);
        }
        //连续的floor
        for(let i=0;i<floorNumber;i++){
            createBox(new THREE.Vector3(0,0,lastObjectInMap.get('position')[2]+2),ZERO_QUATERNION,2,2,2,0,2,newMaterial);
            lastObjectInMap.set('type','Box');
            lastObjectInMap.set('position',[0,0,lastObjectInMap.get('position')[2]+2]);
        }
        //几字形的floor
        for(let i=0;i<floorNumber;i++){
            createBox(new THREE.Vector3(lastObjectInMap.get('position')[0]+2,0,lastObjectInMap.get('position')[2]),ZERO_QUATERNION,2,2,2,0,2,newMaterial);
            lastObjectInMap.set('type','Box');
            lastObjectInMap.set('position',[lastObjectInMap.get('position')[0]+2,0,lastObjectInMap.get('position')[2]]);
            //console.log(lastObjectInMap.get('position'));
            if(i===floorNumber-1){
                createBarrier(new THREE.Vector3(lastObjectInMap.get('position')[0],0,lastObjectInMap.get('position')[2]));
                console.log(lastObjectInMap.get('position'));
            }
        }
        for(let i=0;i<floorNumber;i++){
            createBox(new THREE.Vector3(lastObjectInMap.get('position')[0],0,lastObjectInMap.get('position')[2]+2),ZERO_QUATERNION,2,2,2,0,2,newMaterial);
            lastObjectInMap.set('type','Box');
            lastObjectInMap.set('position',[lastObjectInMap.get('position')[0],0,lastObjectInMap.get('position')[2]+2]);
        }
        for(let i=0;i<floorNumber;i++){
            createBox(new THREE.Vector3(lastObjectInMap.get('position')[0]-2,0,lastObjectInMap.get('position')[2]),ZERO_QUATERNION,2,2,2,0,2,newMaterial);
            lastObjectInMap.set('type','Box');
            lastObjectInMap.set('position',[lastObjectInMap.get('position')[0]-2,0,lastObjectInMap.get('position')[2]]);
        }
    }
    function createObjects() {

        //创建地图
        createMap();
        /*createBox(new THREE.Vector3(0, -0.5, 0), ZERO_QUATERNION, 5, 1, 5, 0, 2);
        createBox(new THREE.Vector3(54.134429931640625, 10.012664794921875, 250), ZERO_QUATERNION, 5, 1, 5, 0, 2);*/
        /*var quaternion = new THREE.Quaternion(0, 0, 0, 1);
        quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 18);
        createBox(new THREE.Vector3(0, -1.5, 0), quaternion, 8, 4, 10, 0);*/

        //创建球体
        createSphere(new THREE.Vector3(0,3,0),ZERO_QUATERNION,1,32,32,5,1000);

    }

    // - Init -
    initGraphics();
    initPhysics();
    createObjects();
    tick();
});